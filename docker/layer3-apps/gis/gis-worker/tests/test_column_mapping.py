"""Tests for column alias resolution and properties exclusion."""

from worker.ingest import _build_properties_exclusion, _resolve_col


class TestResolveCol:
    def test_direct_match(self):
        """Column found directly in staging."""
        staging_cols = {"pnu", "jibun", "geom", "gid"}
        aliases = {"pnu": ["pnu"]}
        expr, matched = _resolve_col("pnu", staging_cols, aliases)
        assert matched == "pnu"
        assert 's."pnu"' in expr

    def test_alias_match(self):
        """Column found via alias."""
        staging_cols = {"bldnm", "geom", "gid"}
        aliases = {"bld_name": ["bld_name", "bldnm", "bdnm", "name", "nm"]}
        expr, matched = _resolve_col("bld_name", staging_cols, aliases)
        assert matched == "bldnm"
        assert 's."bldnm"' in expr

    def test_no_match_returns_null(self):
        """No matching column returns NULL."""
        staging_cols = {"geom", "gid"}
        aliases = {"bld_name": ["bld_name", "bldnm"]}
        expr, matched = _resolve_col("bld_name", staging_cols, aliases)
        assert expr == "NULL"
        assert matched is None

    def test_first_alias_wins(self):
        """When multiple aliases match, first one wins."""
        staging_cols = {"bld_name", "bldnm", "geom"}
        aliases = {"bld_name": ["bld_name", "bldnm"]}
        expr, matched = _resolve_col("bld_name", staging_cols, aliases)
        assert matched == "bld_name"

    def test_cast_applied(self):
        """Cast expression applied when column found."""
        staging_cols = {"area", "geom"}
        aliases = {"area_m2": ["area_m2", "area"]}
        expr, matched = _resolve_col("area_m2", staging_cols, aliases, cast="::numeric(12,2)")
        assert matched == "area"
        assert "::numeric(12,2)" in expr
        assert "NULLIF" in expr

    def test_cast_not_applied_on_null(self):
        """Cast not applied when no column match → NULL."""
        staging_cols = {"geom"}
        aliases = {"area_m2": ["area_m2", "area"]}
        expr, matched = _resolve_col("area_m2", staging_cols, aliases, cast="::numeric")
        assert expr == "NULL"
        assert matched is None

    def test_no_aliases_uses_target_col(self):
        """When aliases dict has no entry, target_col itself is tried."""
        staging_cols = {"custom_col", "geom"}
        aliases = {}
        expr, matched = _resolve_col("custom_col", staging_cols, aliases)
        assert matched == "custom_col"


class TestBuildPropertiesExclusion:
    def test_empty_matched(self):
        """No matched columns → only geom and gid excluded."""
        result = _build_properties_exclusion([])
        assert result == "to_jsonb(s) - 'geom' - 'gid'"

    def test_with_matched_cols(self):
        """Matched columns are excluded from jsonb."""
        result = _build_properties_exclusion(["pnu", "jibun"])
        assert "'pnu'" in result
        assert "'jibun'" in result
        assert "'geom'" in result
        assert "'gid'" in result

    def test_none_in_matched_skipped(self):
        """None values (unmatched cols) are skipped."""
        result = _build_properties_exclusion(["pnu", None, "jibun"])
        assert "'pnu'" in result
        assert "'jibun'" in result
        # None should not appear
        assert result.count("None") == 0
