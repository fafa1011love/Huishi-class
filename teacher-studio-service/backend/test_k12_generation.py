import copy
import unittest
from unittest.mock import patch

import k12_templates
import ollama_adapter
import server


def request():
    return {
        "stage": "小学",
        "templateStage": "小学1-3年级",
        "grade": "一年级",
        "subject": "数学",
        "topic": "认识钟表",
        "lessonType": "新授课",
        "duration": 40,
        "learningSituation": "学生能说出整点，但还不会用规范方法读出几时几分。",
        "keyPoints": "认识钟面上的时针和分针",
        "difficulties": "区分时针和分针的位置变化",
        "homework": "完成钟表读数练习并画出一个整点钟面。",
        "textbookVersion": "必修第一册",
        "chapter": "函数的概念",
        "materialName": "高中数学教材",
        "materialPolicy": "教材优先，允许补充",
        "materialText": "本节介绍函数的概念与表示方法。",
    }


def generated_content():
    return {
        "overview": "学生通过观察钟面、拨动学具和读写时间，认识时针与分针的作用，并在生活情境中准确表达整点时间。",
        "coreQuestion": "怎样根据时针和分针的位置读出钟面上的时间？",
        "objectives": ["能指出时针和分针", "能读出整点时间并说明判断依据"],
        "situation": "学生已有看钟表的生活经验，但容易混淆时针和分针。",
        "priorKnowledge": ["知道钟面有12个数字", "有看整点时间的生活经验"],
        "keyPoints": ["时针和分针的区别", "根据分针指向12判断整点"],
        "difficulties": ["根据指针位置准确读出时间"],
        "misconceptions": ["把较长的分针当成时针", "只看一个指针就读时间"],
        "examPoints": ["根据钟面图读出整点时间", "判断两个钟面表示的时间是否相同"],
        "methods": "生活情境、学具操作、同伴交流和分层练习",
        "resources": "教材、钟表学具、钟面图片、练习单",
        "assessment": "观察学生操作钟面、口头读时和练习单完成情况。",
        "homework": "完成钟表读数练习并画出一个整点钟面。",
        "blackboard": ["认识钟表", "时针短、分针长", "分针指向12 → 整点"],
        "phaseContent": [
            {"teacher": "出示上学时间的钟面图片，提出读时间的问题并说明本课任务。", "student": "观察钟面，说出自己看到的指针和初步读数。", "check": "能指出钟面上的数字和两根指针。", "visibleOutput": "学生的初步读数和疑问。"},
            {"teacher": "引导学生比较两根指针的长短、粗细和转动特点，组织学具观察。", "student": "拨动钟表学具，记录时针和分针的不同。", "check": "能说出时针和分针各自的特征。", "visibleOutput": "指针特征记录。"},
            {"teacher": "示范先看分针、再看时针的读时方法，并用一个钟面逐步演示。", "student": "跟随示范拨出整点时间，用完整句子读出来。", "check": "能按先分针后时针的顺序说明判断。", "visibleOutput": "一份读时步骤和一个正确钟面。"},
            {"teacher": "提供不同钟面和易错钟面，引导学生辨析错误并修正。", "student": "独立判断、同伴核对，并说明错误原因。", "check": "能指出错误指针和正确读法。", "visibleOutput": "修正后的钟面读数。"},
            {"teacher": "回到生活情境，组织出口条练习并总结读整点的方法。", "student": "完成出口条，回答核心问题并说出仍有疑问的地方。", "check": "能独立读出新钟面并说出依据。", "visibleOutput": "出口条或口头总结。"},
        ],
    }


class K12GenerationTests(unittest.TestCase):
    def test_subject_aliases_match_template_profiles(self):
        for subject, expected_key in (("道德与法治", "政治"), ("生物学", "生物"), ("体育与健康", "体育")):
            with self.subTest(subject=subject):
                profile = k12_templates.template_profile({"stage": "初中", "subject": subject})
                self.assertEqual(profile["subjectKey"], expected_key)
                self.assertEqual(profile["subjectProfile"], k12_templates.K12_SUBJECT_PROFILES[expected_key])

    def test_adapter_returns_ai_generation_and_validates_five_phase_contract(self):
        content = generated_content()
        captured = {}

        def fake_generate(system_prompt, user_prompt, validator=None, **kwargs):
            captured["prompt"] = user_prompt
            self.assertIsNone(validator(content))
            return content, None

        with patch.object(ollama_adapter, "status", return_value={"available": True, "model": "qwen3:4b"}), patch.object(ollama_adapter, "generate_json", side_effect=fake_generate):
            result, generation = ollama_adapter.generate_k12_lesson_content(request(), k12_templates.template_profile(request()))

        self.assertEqual(generation["engine"], "ollama")
        self.assertEqual(len(result["phaseContent"]), 5)
        self.assertIn("认识钟表", captured["prompt"])
        self.assertIn("必修第一册", captured["prompt"])
        self.assertIn("函数的概念", captured["prompt"])
        self.assertIn("教材优先，允许补充", captured["prompt"])

    def test_adapter_reports_unavailable_without_template_success(self):
        with patch.object(ollama_adapter, "status", return_value={"available": False, "model": "qwen3:4b", "message": "Ollama 未连接"}):
            result, generation = ollama_adapter.generate_k12_lesson_content(request(), {})

        self.assertIsNone(result)
        self.assertEqual(generation["engine"], "unavailable")
        self.assertIn("未连接", generation["message"])

    def test_server_preserves_teacher_fields_and_assembles_schedule(self):
        teacher_request = request()
        generated = generated_content()
        with patch.object(server.ollama_adapter, "generate_k12_lesson_content", return_value=(copy.deepcopy(generated), {"engine": "ollama", "model": "qwen3:4b", "message": "AI 已生成"})):
            plan = server.generate_k12_lesson(teacher_request)

        self.assertEqual(plan["generation"]["engine"], "ollama")
        self.assertEqual(sum(item["time"] for item in plan["phases"]), 40)
        self.assertEqual(len(plan["phases"]), 5)
        self.assertTrue(all(item.get("output") for item in plan["phases"]))
        self.assertEqual(plan["keyPoints"], ["认识钟面上的时针和分针"])
        self.assertEqual(plan["homework"], teacher_request["homework"])
        self.assertEqual(plan["request"]["textbookVersion"], "必修第一册")
        self.assertEqual(plan["generationStandard"]["textbookContext"]["chapter"], "函数的概念")

    def test_server_raises_without_ai_result(self):
        failure = {"engine": "unavailable", "model": "qwen3:4b", "message": "AI 当前未连接"}
        with patch.object(server.ollama_adapter, "generate_k12_lesson_content", return_value=(None, failure)):
            with self.assertRaises(server.K12GenerationError) as context:
                server.generate_k12_lesson(request())

        self.assertEqual(context.exception.generation, failure)


if __name__ == "__main__":
    unittest.main()
