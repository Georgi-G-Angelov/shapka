import unittest

from play_version_code import codes_from_responses, next_version_code


class NextVersionCodeTests(unittest.TestCase):
    def test_play_ahead_of_the_commit_count_wins(self):
        # A hand-picked code put Play ahead of the commit count.
        self.assertEqual(next_version_code(843, [708, 1000, 1007]), 1008)

    def test_commit_count_ahead_of_play_wins(self):
        self.assertEqual(next_version_code(1500, [1008]), 1500)

    def test_equal_count_still_moves_past_play(self):
        self.assertEqual(next_version_code(1008, [1008]), 1009)

    def test_nothing_published_uses_the_count(self):
        self.assertEqual(next_version_code(843, []), 843)


class CodesFromResponsesTests(unittest.TestCase):
    def test_collects_bundles_apks_and_every_track_release(self):
        codes = codes_from_responses(
            {"bundles": [{"versionCode": 1007}, {"versionCode": 1008}]},
            {"apks": [{"versionCode": 12}]},
            {"tracks": [
                {"track": "production", "releases": [{"versionCodes": ["1008"]}]},
                {"track": "internal", "releases": [{"versionCodes": ["708"]}]},
                {"track": "beta"},
            ]},
        )
        self.assertEqual(sorted(codes), [12, 708, 1007, 1008, 1008])

    def test_empty_responses_give_no_codes(self):
        self.assertEqual(codes_from_responses({}, {}, {}), [])


if __name__ == "__main__":
    unittest.main()
