#!/usr/bin/env python3
"""成就規則引擎單元測試。執行：python3 scripts/test-achievements.py"""

import importlib.util
import os
import sys
import unittest

BASE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("ba", os.path.join(BASE, "build-achievements.py"))
ba = importlib.util.module_from_spec(spec)
spec.loader.exec_module(ba)

REGISTRY = {
    "conf-2020": {"eventId": "conf-2020", "date": "2020-11-27", "type": "conference", "topics": ["ddd-core"]},
    "conf-2021": {"eventId": "conf-2021", "date": "2021-10-15", "type": "conference", "topics": ["ddd-core"]},
    "conf-2023": {"eventId": "conf-2023", "date": "2023-09-16", "type": "conference", "topics": ["ddd-core"]},
    "conf-2024": {"eventId": "conf-2024", "date": "2024-09-13", "type": "conference", "topics": ["ddd-core"]},
    "meetup-a": {"eventId": "meetup-a", "date": "2021-05-22", "type": "meetup", "topics": ["collaboration"]},
    "book-a": {"eventId": "book-a", "date": "2023-11-06", "type": "bookclub", "topics": ["tdd"]},
    "tour-a": {"eventId": "tour-a", "date": "2025-09-06", "type": "tour", "topics": ["architecture"]},
    "es-1": {"eventId": "es-1", "date": "2024-02-29", "type": "meetup", "topics": ["eventstorming"]},
}


def rec(event_ids, topics=None):
    return {
        "eventIds": set(event_ids),
        "dates": {REGISTRY[e]["date"] for e in event_ids},
        "topics": topics or {},
        "seriesAttend": {},
        "events": {(e, e): True for e in event_ids},
        "score": 0.0,
    }


class TestRank(unittest.TestCase):
    def test_thresholds(self):
        self.assertEqual(ba.rank_of(0.5), "value-object")
        self.assertEqual(ba.rank_of(3), "entity")
        self.assertEqual(ba.rank_of(8), "aggregate-root")
        self.assertEqual(ba.rank_of(15), "bounded-context")
        self.assertEqual(ba.rank_of(25), "domain-expert")

    def test_next_threshold(self):
        self.assertEqual(ba.next_threshold(1), 3)
        self.assertEqual(ba.next_threshold(8), 15)
        self.assertIsNone(ba.next_threshold(99))


class TestBadges(unittest.TestCase):
    def b(self, event_ids, topics=None):
        return ba.compute_badges(rec(event_ids, topics), REGISTRY)

    def test_first(self):
        self.assertIn("first", self.b(["meetup-a"]))

    def test_founding_witness(self):
        self.assertIn("founding", self.b(["conf-2020"]))
        self.assertNotIn("founding", self.b(["conf-2021"]))

    def test_old_guard(self):
        self.assertIn("old-guard", self.b(["meetup-a"]))       # 2021
        self.assertNotIn("old-guard", self.b(["book-a"]))      # 2023

    def test_conf_regular_2022_gap_counts_as_consecutive(self):
        # 2021→2023 中間 2022 停辦，序列上視為連續
        self.assertIn("conf-regular", self.b(["conf-2021", "conf-2023", "conf-2024"]))
        self.assertNotIn("conf-regular", self.b(["conf-2020", "conf-2023", "conf-2024"][:2]))

    def test_globetrotter_needs_three_types(self):
        self.assertIn("globetrotter", self.b(["conf-2020", "meetup-a", "book-a"]))
        self.assertNotIn("globetrotter", self.b(["conf-2020", "meetup-a"]))

    def test_tourer(self):
        self.assertIn("tourer", self.b(["tour-a"]))

    def test_es_gold(self):
        self.assertIn("es-gold", self.b(["es-1"], topics={"eventstorming": 5}))
        self.assertNotIn("es-gold", self.b(["es-1"], topics={"eventstorming": 4}))

    def test_milestones(self):
        five = ["conf-2020", "conf-2021", "conf-2023", "conf-2024", "meetup-a"]
        badges = self.b(five)
        self.assertIn("m5", badges)
        self.assertNotIn("m10", badges)


class TestEmailHash(unittest.TestCase):
    def test_normalized(self):
        self.assertEqual(ba.email_hash(" A@B.com "), ba.email_hash("a@b.com"))


if __name__ == "__main__":
    unittest.main(verbosity=1)
