"""Local Ollama adapter for structured lesson generation."""
from __future__ import annotations

import json
import os
from pathlib import Path
from urllib.error import URLError
from urllib.request import Request, urlopen


def _env(name, fallback=""):
    if name in os.environ:
        return os.environ[name].strip()
    root = Path(__file__).resolve().parents[1]
    for path in (root / ".env", root.parent / ".env.local", root.parent / ".env"):
        if not path.is_file():
            continue
        for line in path.read_text(encoding="utf-8-sig").splitlines():
            key, separator, value = line.strip().partition("=")
            if separator and key.strip() == name:
                return value.strip().strip("\"'")
    return fallback


DEFAULT_BASE_URL = _env("OLLAMA_BASE_URL", "http://127.0.0.1:11434").rstrip("/")
DEFAULT_MODEL = _env("OLLAMA_MODEL", "qwen3:4b")


def _request(path, payload=None, timeout=3):
    data = None if payload is None else json.dumps(payload, ensure_ascii=False).encode("utf-8")
    request = Request(
        DEFAULT_BASE_URL + path,
        data=data,
        headers={"Content-Type": "application/json", "Accept": "application/json"},
        method="POST" if data is not None else "GET",
    )
    with urlopen(request, timeout=timeout) as response:
        return json.loads(response.read().decode("utf-8"))


def status():
    try:
        payload = _request("/api/tags", timeout=1.5)
        models = [item.get("name", "") for item in payload.get("models", [])]
        available = DEFAULT_MODEL in models or any(name.split(":")[0] == DEFAULT_MODEL.split(":")[0] for name in models)
        return {
            "available": available,
            "serviceReachable": True,
            "model": DEFAULT_MODEL,
            "installedModels": models,
            "message": "本地模型可用" if available else f"Ollama 已运行，但未安装 {DEFAULT_MODEL}",
        }
    except Exception as exc:
        return {
            "available": False,
            "serviceReachable": False,
            "model": DEFAULT_MODEL,
            "installedModels": [],
            "message": f"Ollama 未连接：{exc}",
        }


def generate_json(system_prompt, user_prompt, validator=None, timeout=120, format_schema=None, error_meta=None):
    last_error = None
    prompt = user_prompt
    for attempt in range(3):
        try:
            response = _request(
                "/api/generate",
                {
                    "model": DEFAULT_MODEL,
                    "system": system_prompt,
                    "prompt": prompt,
                    "stream": False,
                    "format": format_schema or "json",
                    "think": False,
                    "keep_alive": "15m",
                    "options": {"temperature": 0.2, "seed": 20260625, "num_ctx": 16384},
                },
                timeout=timeout,
            )
            raw = str(response.get("response") or "{}").strip()
            # Qwen can still wrap valid JSON in a markdown fence even when the
            # Ollama JSON format is requested. Extract the outer object before
            # validation so harmless presentation text does not trigger fallback.
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[1] if "\n" in raw else raw
                raw = raw.rsplit("```", 1)[0].strip()
            result = json.loads(raw)
            if validator:
                error = validator(result)
                if error:
                    last_error = error
                    if error_meta is not None:
                        error_meta["kind"] = "validation"
                    prompt = user_prompt + f"\n上次输出未通过校验：{error}。只返回修正后的 JSON。"
                    continue
            return result, None
        except json.JSONDecodeError as exc:
            last_error = str(exc)
            if error_meta is not None:
                error_meta["kind"] = "invalid-output"
            prompt = user_prompt + f"\n上次输出不是合法 JSON：{last_error}。只返回合法 JSON。"
        except (ValueError, KeyError, URLError, TimeoutError, OSError) as exc:
            last_error = str(exc)
            if error_meta is not None:
                error_meta["kind"] = "connection"
            prompt = user_prompt + f"\n上次输出失败：{last_error}。只返回合法 JSON。"
    return None, last_error or "本地模型未返回有效 JSON"


def generate_k12_lesson_content(request, scaffold):
    """Generate the teacher-readable K12 content inside a fixed five-phase scaffold."""
    current = status()
    if not current["available"]:
        message = "AI 当前未连接，请检查本地模型后重试"
        if current.get("serviceReachable") and current.get("model"):
            message = f"AI 当前未连接，请先安装 {current['model']} 后重试"
        return None, {"engine": "unavailable", "model": DEFAULT_MODEL, "message": message, "detail": current.get("message", "")}

    request = request or {}
    subject_profile = scaffold.get("subjectProfile") or {}
    phase_names = list(scaffold.get("phase_names") or [])
    source_text = str(request.get("materialText") or "").strip()[:8000]
    textbook_context = {
        "textbookVersion": request.get("textbookVersion") or "",
        "chapter": request.get("chapter") or "",
        "materialName": request.get("materialName") or "",
        "materialPolicy": request.get("materialPolicy") or "",
        "materialText": source_text,
    }
    teacher_fields = {
        key: request.get(key)
        for key in (
            "learningSituation", "priorKnowledge", "misconceptions", "coreQuestion", "objectives",
            "keyPoints", "difficulties", "methods", "resources", "assessment", "homework", "examPoints",
        )
        if request.get(key)
    }
    prompt = {
        "task": "生成一份面向普通教师、可以直接拿去上课的 K12 教案内容",
        "course": {
            "stage": request.get("stage"),
            "templateStage": scaffold.get("templateStage"),
            "grade": request.get("grade"),
            "subject": request.get("subject"),
            "topic": request.get("topic"),
            "lessonType": request.get("lessonType") or "新授课",
            "duration": request.get("duration") or 40,
        },
        "textbookContext": textbook_context,
        "teachingTemplate": {
            "phaseNames": phase_names,
            "stageFocus": scaffold.get("focus"),
            "studentStyle": scaffold.get("student_style"),
            "subjectFocus": subject_profile.get("focus"),
            "learningEvidence": subject_profile.get("evidence"),
            "methodHint": subject_profile.get("method_hint"),
            "resourceHint": subject_profile.get("resource_hint"),
        },
        "teacherInputs": teacher_fields,
        "sourceMaterial": source_text,
        "rules": [
            "课题、学段、年级、学科和课时必须与输入完全一致，不得改名或另起课题。",
            "教师已经填写的内容是优先依据，只能在其基础上具体化，不能用无关内容替换。",
            "每个教学环节必须写清教师要做什么、学生要做什么、检查什么、学生留下什么产出。",
            "内容要写成可以执行的课堂动作，避免理解核心概念、完成迁移应用、根据实际情况补充等空泛或占位表达。",
            "只使用与课题、学科和年级相符的知识，不凭空添加教材没有提供的具体事实。",
            "填写教材册次或模块时，教学内容、重点、流程和作业优先限定在该教材范围内。",
            "填写具体章节时，五个教学环节必须围绕该章节组织，不混用其他册次内容。",
            "教师上传或粘贴的教材内容优先于通用教材知识；教材信息为空时才根据课题、学科、年级和教师要求组织内容。",
            "不得因为教材标注为选修就擅自添加课题或资料中没有出现的知识。",
            "只返回简体中文 JSON，不要 Markdown，不要解释生成过程。",
        ],
        "output": {
            "overview": "80到160字的课程概览，说明本课学什么、怎么学、用什么证据判断学会了",
            "coreQuestion": "一个围绕本课课题、学生可以通过课堂活动回答的核心问题",
            "objectives": ["2到4条可观察、可检查的学习目标"],
            "situation": "结合年级和学科说明学生已有基础、可能困难以及本课教学起点",
            "priorKnowledge": ["2到3条本课需要的前置知识或经验"],
            "keyPoints": ["2到4条具体教学重点"],
            "difficulties": ["1到3条具体教学难点和突破方向"],
            "misconceptions": ["2到3条学生可能出现的具体错误或混淆"],
            "examPoints": ["1到3条适合本课检测或迁移的内容"],
            "methods": "具体说明本课采用的教学方法和组织方式",
            "resources": "具体说明教材、课件、材料、器材或学习单",
            "assessment": "说明如何通过课堂表现、任务产出或练习判断学生是否学会",
            "homework": "与本课目标对应、可以提交或检查的课后任务",
            "blackboard": ["3到6条与课题、重点和方法对应的板书内容"],
            "phaseContent": [
                {
                    "teacher": "教师活动：具体到出示什么、提问什么、如何组织和如何反馈",
                    "student": "学生活动：具体到观察、朗读、计算、实验、讨论、表达或练习动作",
                    "check": "评价检查：教师用什么问题、标准或证据判断学习情况",
                    "visibleOutput": "学生在本环节留下的可见产出",
                }
                for _ in phase_names
            ],
        },
    }

    required = (
        "overview", "coreQuestion", "objectives", "situation", "priorKnowledge", "keyPoints",
        "difficulties", "misconceptions", "examPoints", "methods", "resources", "assessment",
        "homework", "blackboard", "phaseContent",
    )
    list_fields = ("objectives", "priorKnowledge", "keyPoints", "difficulties", "misconceptions", "examPoints", "blackboard")
    banned_phrases = ("待填写", "根据实际情况补充", "理解核心概念", "完成迁移应用", "相关已有知识")

    validation_meta = {}

    def validate(value):
        if not isinstance(value, dict):
            return "顶层必须是 JSON 对象"
        if any(key not in value for key in required):
            return "缺少必需字段"
        text_fields = ("overview", "coreQuestion", "situation", "methods", "resources", "assessment", "homework")
        if any(not isinstance(value.get(key), str) or not value[key].strip() for key in text_fields):
            return "课程概览、核心问题和课堂安排字段不能为空"
        for key in list_fields:
            items = value.get(key)
            if not isinstance(items, list) or not items or any(not str(item).strip() for item in items):
                return f"{key} 必须是非空文本数组"
        if len(value["phaseContent"]) != len(phase_names):
            return f"phaseContent 必须包含 {len(phase_names)} 个环节"
        phase_keys = ("teacher", "student", "check", "visibleOutput")
        for item in value["phaseContent"]:
            if not isinstance(item, dict) or any(not str(item.get(key) or "").strip() for key in phase_keys):
                return "教学环节必须完整包含教师活动、学生活动、评价检查和学生产出"
        text = json.dumps(value, ensure_ascii=False)
        if any(phrase in text for phrase in banned_phrases):
            return "内容仍包含空泛或占位表达，请结合课题改写"
        topic = str(request.get("topic") or "").strip()
        if len(topic) >= 2:
            terms = [topic[index:index + 2] for index in range(len(topic) - 1) if topic[index:index + 2].strip()]
            if terms and not any(term in text for term in terms):
                return f"生成内容与课题“{topic}”不相关"
        return None

    text_fields = ("overview", "coreQuestion", "situation", "methods", "resources", "assessment", "homework")
    schema = {
        "type": "object",
        "properties": {
            **{key: {"type": "string"} for key in text_fields},
            **{key: {"type": "array", "items": {"type": "string"}, "minItems": 1} for key in list_fields},
            "phaseContent": {
                "type": "array", "minItems": len(phase_names), "maxItems": len(phase_names),
                "items": {
                    "type": "object",
                    "properties": {key: {"type": "string"} for key in ("teacher", "student", "check", "visibleOutput")},
                    "required": ["teacher", "student", "check", "visibleOutput"],
                    "additionalProperties": False,
                },
            },
        },
        "required": [*text_fields, *list_fields, "phaseContent"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是经验丰富的 K12 一线教师和教案设计师。严格按照给定学段、学科和五段课堂结构生成可执行教案。" \
        "不要生成空泛的教学套话，不要把其他学科或其他年级的内容套进来。只返回符合 JSON Schema 的 JSON。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validate,
        timeout=180,
        format_schema=schema,
        error_meta=validation_meta,
    )
    if result is None:
        if validation_meta.get("kind") in {"validation", "invalid-output"}:
            message = "AI 已响应，但内容未通过检查，请重试"
        else:
            message = "AI 当前未连接，请检查本地模型后重试"
        return None, {"engine": "unavailable", "model": DEFAULT_MODEL, "message": message, "detail": error or ""}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 生成 K12 教案内容"}


def generate_lesson_content(request, scaffold, duration, activity_count):
    """Generate the topic-specific lesson content used to build the workflow."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:8000]
    prompt = {
        "task": "生成一份本科课程的真实教学内容，不要套用固定器官模板",
        "course": {
            "subject": request.get("subject") or "生物医学",
            "field": request.get("field"),
            "courseName": request.get("courseName"),
            "topic": request.get("topic"),
            "duration": duration,
            "abilityLevel": request.get("abilityLevel") or "基础层",
            "priorKnowledge": request.get("prerequisites") or request.get("priorKnowledge"),
        },
        "teacherMaterial": source_text,
        "outputRules": {
            "onlyJson": True,
            "language": "简体中文",
            "noGenericPlaceholders": True,
            "noUnrelatedFacts": True,
            "activityCount": activity_count,
        },
        "output": {
            "title": "本次课标题",
            "overview": "80到140字课程概览",
            "coreQuestion": "一个需要通过结构、机制、证据或操作回答的核心问题",
            "prerequisites": ["3条具体先修基础"],
            "keyPoints": ["4条本课重点"],
            "difficulties": ["3条本课难点"],
            "contentFacts": ["4条事实性知识"],
            "contentConcepts": ["4条概念性知识"],
            "contentProcedures": ["3条程序性知识，写明动作或推理步骤"],
            "contentMetacognition": ["2条元认知知识或自检策略"],
            "misconceptions": ["3条学生可能出现的具体错误"],
            "questionChain": [{"level": "观察或理解或分析或应用或表达", "question": "问题", "followUp": "教师追问", "studentGain": "学生所得"}],
            "activities": [{"name": "活动名称", "type": "活动类型", "studentAction": "学生具体任务", "learningContent": "学习内容", "visibleOutput": "可见产出", "evaluationStandard": "量化或可检查评价标准", "remediation": "未达标补救", "caseOrEvidence": "使用的案例、材料或证据"}],
            "casePrompt": "与本课主题直接相关的教学案例或应用情境",
            "homework": "可提交、可评价的课后任务"
        }
    }

    def validate(value):
        required = ("title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework")
        if not isinstance(value, dict):
            return "顶层必须是 JSON 对象"
        if any(key not in value for key in required):
            return "缺少必需字段"
        for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions"):
            if not isinstance(value.get(key), list) or not value[key] or any(not str(item).strip() for item in value[key]):
                return f"{key} 必须是非空文本数组"
        if not isinstance(value.get("questionChain"), list) or len(value["questionChain"]) < 3:
            return "问题链至少需要3个问题"
        if not isinstance(value.get("activities"), list) or len(value["activities"]) != activity_count:
            return f"活动数量必须为 {activity_count}"
        for item in value["questionChain"]:
            if not all(str(item.get(key) or "").strip() for key in ("level", "question", "followUp", "studentGain")):
                return "问题链字段不完整"
        for item in value["activities"]:
            if not all(str(item.get(key) or "").strip() for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")):
                return "活动字段不完整"
        topic = str(request.get("topic") or "").strip()
        corpus = json.dumps(value, ensure_ascii=False)
        topic_terms = [topic[index:index + 2] for index in range(max(0, len(topic) - 1)) if topic[index:index + 2].strip()]
        if topic_terms and not any(term in corpus for term in topic_terms):
            return f"生成内容与课题“{topic}”不相关，必须围绕教师输入课题重做"
        return None

    schema = {
        "type": "object",
        "properties": {
            "title": {"type": "string"}, "overview": {"type": "string"}, "coreQuestion": {"type": "string"},
            **{key: {"type": "array", "items": {"type": "string"}} for key in ("prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions")},
            "questionChain": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("level", "question", "followUp", "studentGain")}, "required": ["level", "question", "followUp", "studentGain"], "additionalProperties": False}},
            "activities": {"type": "array", "items": {"type": "object", "properties": {key: {"type": "string"} for key in ("name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence")}, "required": ["name", "type", "studentAction", "learningContent", "visibleOutput", "evaluationStandard", "remediation", "caseOrEvidence"], "additionalProperties": False}},
            "casePrompt": {"type": "string"}, "homework": {"type": "string"},
        },
        "required": ["title", "overview", "coreQuestion", "prerequisites", "keyPoints", "difficulties", "contentFacts", "contentConcepts", "contentProcedures", "contentMetacognition", "misconceptions", "questionChain", "activities", "casePrompt", "homework"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科教学设计师。根据教师输入生成具体课程内容。不要把心脏、肺或其他固定模板内容套到不相关课题上；不确定的医学事实应依据教师资料或用教学性表述限定。只返回符合 JSON Schema 的 JSON。",
        json.dumps(prompt, ensure_ascii=False), validator=validate, timeout=180, format_schema=schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型回退：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 生成课程内容"}


def enhance_lesson_language(request, lesson_context):
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "只润色本科生物医学课堂语言，不增加未提供的医学事实",
        "topic": request.get("topic"),
        "abilityLevel": request.get("abilityLevel", "基础层"),
        "sourceMaterial": source_text,
        "groundedFacts": lesson_context,
        "output": {
            "introScript": "不超过120字，保留认知缺口",
            "studentPrediction": "不超过100字",
            "summaryPrompt": "不超过100字，回扣专业能力目标",
            "homeworkPrompt": "不超过120字，可操作、可提交",
        },
    }

    def validate(value):
        required = ("introScript", "studentPrediction", "summaryPrompt", "homeworkPrompt")
        if not isinstance(value, dict) or any(not str(value.get(key) or "").strip() for key in required):
            return "缺少必需字段"
        if any(len(str(value[key])) > 180 for key in required):
            return "字段过长"
        return None

    result, error = generate_json(
        "你是严谨的本科生物医学教师。只能改写课堂语言，不得添加诊断或治疗建议，不得伪造教材来源。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validate,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型回退：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": "已使用本地模型增强课堂语言"}


def _json_schema_for(value):
    if isinstance(value, dict):
        return {
            "type": "object",
            "properties": {key: _json_schema_for(item) for key, item in value.items()},
            "required": list(value.keys()),
            "additionalProperties": False,
        }
    if isinstance(value, list):
        return {"type": "array", "items": _json_schema_for(value[0]) if value else {}}
    if isinstance(value, bool):
        return {"type": "boolean"}
    if isinstance(value, (int, float)):
        return {"type": "number"}
    if value is None:
        return {"type": ["string", "number", "boolean", "null"]}
    return {"type": "string"}


def revise_lesson_step(request, step, instruction, context, validator=None):
    """Revise one seven-step lesson section without changing its JSON contract."""
    current = status()
    if not current["available"]:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": current["message"]}

    source_text = str(request.get("materialText") or "").strip()[:6000]
    prompt = {
        "task": "根据教师要求修改本科教案的当前步骤",
        "teacherInstruction": instruction,
        "course": {
            "stage": request.get("stage"),
            "grade": request.get("grade"),
            "subject": request.get("subject"),
            "topic": request.get("topic"),
            "duration": request.get("duration"),
            "abilityLevel": request.get("abilityLevel"),
        },
        "sourceMaterial": source_text,
        "lessonContext": context,
        "currentStep": {
            "id": step.get("id"),
            "title": step.get("title"),
            "data": step.get("data"),
        },
        "outputContract": {
            "data": "返回修改后的完整 currentStep.data；键、数组长度、ID 和数据类型必须保持不变",
            "summary": "用一句中文概括本次修改",
        },
    }
    format_schema = {
        "type": "object",
        "properties": {
            "data": _json_schema_for(step.get("data") or {}),
            "summary": {"type": "string"},
        },
        "required": ["data", "summary"],
        "additionalProperties": False,
    }
    result, error = generate_json(
        "你是严谨的本科生物医学教学设计助手。严格执行教师修改要求，只编辑当前步骤。"
        "不得改变 JSON 结构、字段名、数组长度、对象 ID 或引用关系；不得伪造教材来源、医学证据、诊断或治疗建议。"
        "教学目标必须使用可观察行为，活动必须保留学生产出、评价标准和补救措施。只返回 JSON。",
        json.dumps(prompt, ensure_ascii=False),
        validator=validator,
        timeout=180,
        format_schema=format_schema,
    )
    if result is None:
        return None, {"engine": "builtin-template", "model": DEFAULT_MODEL, "message": f"本地模型编辑失败：{error}"}
    return result, {"engine": "ollama", "model": DEFAULT_MODEL, "message": f"已使用 {DEFAULT_MODEL} 按要求编辑当前步骤"}
