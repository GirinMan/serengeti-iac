#!/usr/bin/env python3
import os
import sys
import argparse
import json
from typing import List, Dict, Any, Union

import requests

PERPLEXITY_SEARCH_URL = "https://api.perplexity.ai/search"
PERPLEXITY_API_KEY = os.environ.get("PERPLEXITY_API_KEY")


class PerplexitySearchError(Exception):
    pass


def perplexity_search(
    query: Union[str, List[str]],
    max_results: int = 5,
    max_tokens_per_page: int = 2048,
    country: str | None = None,
    search_domain_filter: List[str] | None = None,
    search_language_filter: List[str] | None = None,
) -> Dict[str, Any]:
    if not PERPLEXITY_API_KEY:
        raise PerplexitySearchError("PERPLEXITY_API_KEY is not set")

    headers = {
        "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
        "Content-Type": "application/json",
    }

    payload: Dict[str, Any] = {
        "query": query,
        "max_results": max_results,
        "max_tokens_per_page": max_tokens_per_page,
    }

    if country:
        payload["country"] = country
    if search_domain_filter:
        payload["search_domain_filter"] = search_domain_filter
    if search_language_filter:
        payload["search_language_filter"] = search_language_filter

    resp = requests.post(PERPLEXITY_SEARCH_URL, headers=headers, json=payload, timeout=30)
    if resp.status_code != 200:
        raise PerplexitySearchError(
            f"Perplexity Search API error {resp.status_code}: {resp.text}"
        )

    return resp.json()


def main(argv: List[str] | None = None) -> int:
    """
    CLI contract (JSON only, printed to stdout):

    Input via CLI args:
      search-cli-json "query text" [--max-results N] [--country CC]

    Output:
      {
        "ok": true,
        "query": "...",
        "response": { ... Perplexity raw JSON ... }
      }

      or on error:

      {
        "ok": false,
        "error": "message"
      }
    """
    parser = argparse.ArgumentParser(
        prog="search-cli-json",
        description="JSON-only CLI wrapper for Perplexity Search API.",
    )
    parser.add_argument(
        "query",
        nargs="+",
        help="Search query (if multiple tokens, they are joined with spaces).",
    )
    parser.add_argument(
        "--max-results",
        type=int,
        default=5,
        help="Maximum number of results per query (default: 5).",
    )
    parser.add_argument(
        "--country",
        type=str,
        default=None,
        help="ISO country code for geolocated search, e.g. US, KR.",
    )

    args = parser.parse_args(argv)
    query_str = " ".join(args.query)

    try:
        raw = perplexity_search(
            query=query_str,
            max_results=args.max_results,
            country=args.country,
        )
        out = {
            "ok": True,
            "query": query_str,
            "response": raw,
        }
        print(json.dumps(out, ensure_ascii=False))
        return 0
    except PerplexitySearchError as e:
        out = {
            "ok": False,
            "error": str(e),
        }
        print(json.dumps(out, ensure_ascii=False))
        return 1
    except Exception as e:
        out = {
            "ok": False,
            "error": f"unexpected error: {e}",
        }
        print(json.dumps(out, ensure_ascii=False))
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
