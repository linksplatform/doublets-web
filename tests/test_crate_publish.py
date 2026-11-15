"""Offline regression coverage for the release workflow's registry preflight."""

import importlib.util
import io
import json
from pathlib import Path
import unittest
from unittest.mock import patch
from urllib.error import HTTPError, URLError


SCRIPT = Path(__file__).resolve().parents[1] / ".github/scripts/crate_publish.py"
SPEC = importlib.util.spec_from_file_location("crate_publish", SCRIPT)
crate_publish = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(crate_publish)


class CratePublishTest(unittest.TestCase):
    def response(self, version="0.1.3", yanked=False):
        return io.BytesIO(json.dumps({
            "name": "doublets-web", "vers": version, "yanked": yanked,
        }).encode() + b"\n")

    def test_existing_version_is_not_republished(self):
        with patch.object(crate_publish, "urlopen", return_value=self.response()):
            self.assertFalse(crate_publish.needs_publish("0.1.3"))

    def test_later_version_is_published(self):
        with patch.object(crate_publish, "urlopen", return_value=self.response()):
            self.assertTrue(crate_publish.needs_publish("0.1.4"))

    def test_missing_crate_reports_bootstrap_instead_of_attempting_oidc(self):
        error = HTTPError(crate_publish.INDEX_URL, 404, "Not Found", {}, None)
        with patch.object(crate_publish, "urlopen", side_effect=error):
            with self.assertRaisesRegex(RuntimeError, "owner must bootstrap"):
                crate_publish.needs_publish("0.1.3")

    def test_registry_outage_never_triggers_publish(self):
        errors = [HTTPError(crate_publish.INDEX_URL, 503, "Unavailable", {}, None),
                  URLError("connection failed"), TimeoutError("timed out")]
        for error in errors:
            with self.subTest(error=error):
                with patch.object(crate_publish, "urlopen", side_effect=error):
                    with self.assertRaises(type(error)):
                        crate_publish.needs_publish("0.1.3")

    def test_malformed_response_never_triggers_publish(self):
        for body in [b"", b"not json", b'{"name":"other-crate"}\n', b'{}\n']:
            with self.subTest(body=body):
                with patch.object(crate_publish, "urlopen", return_value=io.BytesIO(body)):
                    with self.assertRaises((ValueError, KeyError)):
                        crate_publish.needs_publish("0.1.3")

    def test_yanked_version_is_not_treated_as_success(self):
        with patch.object(crate_publish, "urlopen", return_value=self.response(yanked=True)):
            with self.assertRaisesRegex(RuntimeError, "yanked"):
                crate_publish.needs_publish("0.1.3")

    def test_cli_writes_github_output_for_root_package(self):
        with patch.object(crate_publish, "needs_publish", return_value=False) as decision:
            with patch("sys.stdout", new_callable=io.StringIO) as output:
                crate_publish.main()
            decision.assert_called_once_with("0.1.3")
            self.assertEqual(output.getvalue(), "publish=false\n")


if __name__ == "__main__":
    unittest.main()
