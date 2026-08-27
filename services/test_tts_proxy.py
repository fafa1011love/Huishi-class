import unittest
from pathlib import Path

from services.tts_proxy import build_tts_payload, load_voice_config, normalize_speech_text


class NormalizeSpeechTextTests(unittest.TestCase):
    def test_removes_markup_invisible_characters_and_emoji(self):
        source = "## **地球结构**\u200b 😊 [查看图片](https://example.com/image)"
        self.assertEqual(normalize_speech_text(source), "地球结构 查看图片")

    def test_preserves_chinese_scientific_terms_and_numbers(self):
        source = "HIV 病毒、NaCl 晶体与 SiO₂ 的正确率是 95%。"
        self.assertEqual(normalize_speech_text(source), "HIV 病毒、NaCl 晶体与 SiO2 的正确率是 95%。")

    def test_normalizes_full_width_characters(self):
        self.assertEqual(normalize_speech_text("ＮａＣｌ　晶体"), "NaCl 晶体")

    def test_rejects_content_without_speakable_text(self):
        self.assertEqual(normalize_speech_text("😊 ** ---"), "")

    def test_applies_configurable_ai_and_3d_pronunciations(self):
        pronunciation_map = {
            "A.I.": "诶爱",
            "AI": "诶爱",
            "3-D": "三维",
            "3D": "三维",
        }
        source = "AI ai A.I. a.i. 与 3D 3d 3-D 3-d"
        self.assertEqual(
            normalize_speech_text(source, pronunciation_map),
            "诶爱 诶爱 诶爱 诶爱 与 三维 三维 三维 三维",
        )

    def test_does_not_replace_pronunciations_inside_longer_identifiers(self):
        pronunciation_map = {"AI": "诶爱", "3D": "三维"}
        self.assertEqual(
            normalize_speech_text("AIGC、23D、AI 与 3D", pronunciation_map),
            "AIGC、23D、诶爱 与 三维",
        )


class BuildPayloadTests(unittest.TestCase):
    def setUp(self):
        self.config = {
            "ref_audio_path": "/tmp/reference.wav",
            "prompt_text": "这是参考音频。",
            "prompt_lang": "zh",
        }

    def test_uses_stable_chinese_defaults_for_streaming(self):
        payload = build_tts_payload("你好", True, self.config)
        self.assertEqual(payload["text_lang"], "zh")
        self.assertEqual(payload["streaming_mode"], 1)
        self.assertEqual(payload["top_k"], 15)
        self.assertEqual(payload["top_p"], 0.7)
        self.assertEqual(payload["temperature"], 0.6)
        self.assertEqual(payload["repetition_penalty"], 1.35)
        self.assertEqual(payload["seed"], 12345)
        self.assertEqual(payload["text_split_method"], "cut2")
        self.assertEqual(payload["fragment_interval"], 0.08)

    def test_disables_upstream_streaming_for_buffered_requests(self):
        config = {**self.config, "streaming_mode": 3}
        payload = build_tts_payload("你好", False, config)
        self.assertIs(payload["streaming_mode"], False)

    def test_allows_quality_settings_to_be_configured(self):
        config = {
            **self.config,
            "text_lang": "auto",
            "streaming_mode": 2,
            "top_k": 12,
            "top_p": 0.65,
            "temperature": 0.55,
            "repetition_penalty": 1.4,
            "seed": 7,
        }
        payload = build_tts_payload("你好", True, config)
        self.assertEqual(payload["text_lang"], "zh")
        self.assertEqual(
            {key: payload[key] for key in ("streaming_mode", "top_k", "top_p", "temperature", "repetition_penalty", "seed")},
            {"streaming_mode": 2, "top_k": 12, "top_p": 0.65, "temperature": 0.55, "repetition_penalty": 1.4, "seed": 7},
        )


class VoiceConfigurationTests(unittest.TestCase):
    def test_uses_the_furina_reference_voice(self):
        config = load_voice_config()
        self.assertEqual(config["name"], "小智·芙宁娜")
        self.assertEqual(Path(config["ref_audio_path"]).name, "orbi-custom-lively.wav")
        self.assertTrue(Path(config["ref_audio_path"]).is_file())
        self.assertEqual(config["pronunciation_map"]["AI"], "诶爱")
        self.assertEqual(config["pronunciation_map"]["3D"], "三维")
        self.assertEqual(config["text_split_method"], "cut2")
        self.assertEqual(config["fragment_interval"], 0.08)


if __name__ == "__main__":
    unittest.main()
