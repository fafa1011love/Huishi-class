"""K12 lesson-template routing shared by lesson generation and export metadata."""

K12_TEMPLATE_STAGES = ("小学1-3年级", "小学4-6年级", "初中", "高中")

_LOWER_PRIMARY_GRADES = {"一年级", "二年级", "三年级"}
_UPPER_PRIMARY_GRADES = {"四年级", "五年级", "六年级"}

K12_TEMPLATE_PROFILES = {
    "小学1-3年级": {
        "label": "小学低年级教案模板",
        "phase_names": ["问题导入", "观察与建构", "推理与示范", "辨析与迁移", "回扣与评价"],
        "focus": "用生活情境、直观材料和短时操作帮助学生理解并表达。",
        "student_style": "在教师引导下观察、操作、表达，再用简短练习巩固。",
    },
    "小学4-6年级": {
        "label": "小学高年级教案模板",
        "phase_names": ["问题导入", "观察与建构", "推理与示范", "辨析与迁移", "回扣与评价"],
        "focus": "在已有经验基础上建立概念、方法和迁移应用。",
        "student_style": "先独立思考，再合作交流，用完整语句说明自己的依据。",
    },
    "初中": {
        "label": "初中教案模板",
        "phase_names": ["情境导入", "自主探究", "概念建构", "练习迁移", "总结评价"],
        "focus": "通过问题、观察或实验形成概念，并用证据解释和迁移。",
        "student_style": "提出猜想、记录依据、合作讨论并修正自己的结论。",
    },
    "高中": {
        "label": "高中教案模板",
        "phase_names": ["问题导入", "教材研读", "重点探究", "应用迁移", "总结评价"],
        "focus": "围绕教材核心问题组织分析、论证、方法迁移和学习评价。",
        "student_style": "结合教材和已有知识独立分析，说明推理依据并完成迁移任务。",
    },
}

K12_SUBJECT_PROFILES = {
    "语文": {
        "focus": "围绕文本语句和表达任务，引导学生从朗读、圈画和联系上下文中形成证据。",
        "evidence": "朗读表现、关键词圈画、文本依据和口头或书面表达",
        "method_hint": "朗读感知、圈画批注、联系上下文、交流表达",
        "resource_hint": "教材文本、朗读音频、词句卡片、学习单",
    },
    "数学": {
        "focus": "从具体情境和数量关系出发，引导学生经历读题、表示、计算或推理并说明算理。",
        "evidence": "示意图、算式或推理过程，以及对方法适用条件的说明",
        "method_hint": "问题驱动、操作表示、算理交流、变式练习",
        "resource_hint": "教材、学具或示意图、板书、分层练习",
    },
    "英语": {
        "focus": "在可理解的语境中提供听读输入，再通过句型操练和真实表达完成迁移。",
        "evidence": "关键信息提取、句型使用、角色表达和同伴互评",
        "method_hint": "情境导入、听读输入、句型操练、角色表达",
        "resource_hint": "教材对话、图片或音频、句型卡、表达任务单",
    },
    "物理": {
        "focus": "以现象或实验问题为起点，组织变量观察、证据记录和规律解释。",
        "evidence": "实验记录、变量判断、规律表述和依据说明",
        "method_hint": "问题导入、实验探究、证据归纳、变式应用",
        "resource_hint": "教材、实验器材、现象图片、数据记录单",
    },
    "化学": {
        "focus": "从实验现象出发，连接宏观观察、微观解释和化学用语，形成条件与结论的对应。",
        "evidence": "实验现象记录、微观解释、反应条件和化学用语",
        "method_hint": "实验观察、证据分析、微观解释、规范表达",
        "resource_hint": "教材、实验装置或视频、粒子示意图、练习单",
    },
    "生物": {
        "focus": "通过结构或过程观察建立概念，进一步解释结构与功能、现象与原因之间的关系。",
        "evidence": "观察标注、过程图、结构功能解释和现象判断",
        "method_hint": "观察记录、结构分析、关系建构、现象解释",
        "resource_hint": "教材、结构图或实物、观察记录单、课堂练习",
    },
    "历史": {
        "focus": "借助史料和时间线建立时空关系，引导学生用证据说明事件联系和历史解释。",
        "evidence": "史料信息提取、时空定位、因果关系和观点表达",
        "method_hint": "史料研读、时间线梳理、因果分析、观点表达",
        "resource_hint": "教材、史料、时间轴、历史地图、任务单",
    },
    "地理": {
        "focus": "以地图、图表或真实区域问题为载体，训练信息提取、区域分析和现实应用。",
        "evidence": "地图或图表信息、区域特征、因果解释和应用判断",
        "method_hint": "读图提取、区域比较、规律归纳、问题应用",
        "resource_hint": "教材、地图、统计图表、区域案例、学习单",
    },
    "政治": {
        "focus": "从真实案例和生活问题出发，引导学生辨析观点、寻找依据并作出有理由的判断。",
        "evidence": "案例信息、观点辨析、事实或规范依据和表达结论",
        "method_hint": "案例导入、观点辨析、依据分析、现实迁移",
        "resource_hint": "教材、案例材料、新闻或生活情境、讨论单",
    },
    "体育": {
        "focus": "通过动作示范、分解练习和即时反馈，让学生在安全前提下形成动作要领和自我修正能力。",
        "evidence": "动作完成、要领说明、同伴反馈和练习表现",
        "method_hint": "动作示范、分解练习、同伴纠错、综合运用",
        "resource_hint": "教材、场地器材、动作示范、练习记录表",
    },
}

_SUBJECT_ALIASES = {
    "生物学": "生物",
    "体育与健康": "体育",
    "道德与法治": "政治",
    "思想政治": "政治",
}


def resolve_template_stage(request):
    """Resolve new and legacy stage values without changing stored lesson records."""
    request = request or {}
    stage = str(request.get("templateStage") or request.get("stage") or "").strip()
    grade = str(request.get("grade") or "").strip()
    if stage in K12_TEMPLATE_STAGES:
        return stage
    if stage in {"小学1-3", "小学低段"}:
        return "小学1-3年级"
    if stage in {"小学4-6", "小学高段"}:
        return "小学4-6年级"
    if stage == "小学" or stage.startswith("小学"):
        return "小学1-3年级" if grade in _LOWER_PRIMARY_GRADES else "小学4-6年级"
    if stage.startswith("初中") or grade in {"七年级", "八年级", "九年级"}:
        return "初中"
    return "高中"


def template_profile(request):
    stage = resolve_template_stage(request)
    subject = str((request or {}).get("subject") or "").strip()
    subject_key = _SUBJECT_ALIASES.get(subject, subject)
    subject_profile = K12_SUBJECT_PROFILES.get(subject_key, {
        "focus": "围绕本课问题组织观察、分析、表达和迁移，确保每个环节留下可检查的学习证据。",
        "evidence": "课堂任务记录、口头或书面表达和迁移练习",
        "method_hint": "问题导入、观察分析、合作交流、迁移练习",
        "resource_hint": "教材、课件、板书、课堂练习",
    })
    return {"templateStage": stage, "subject": subject, "subjectKey": subject_key, "subjectProfile": subject_profile, **K12_TEMPLATE_PROFILES[stage]}
