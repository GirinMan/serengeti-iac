# Perplexity Search CLI Tool

This tool exposes Perplexity’s Search API as a simple command‑line program the AI assistant can call as a tool.

## Requirements

- Python 3.9+
- `requests` Python package
- Perplexity API key

## Installation

1. Save the script as `search-cli-json.py`.
2. Make it executable and put it on your `PATH`:

   ```bash
   chmod +x search-cli-json.py
   mv search-cli-json.py /usr/local/bin/search-cli-json
   ```

3. Set your API key:

   ```bash
   export PERPLEXITY_API_KEY="YOUR_API_KEY_HERE"
   ```

## Usage

Basic call:

```bash
search-cli-json "your query here"
```

With options:

```bash
search-cli-json "latest AI news 2026" --max-results 5 --country US
```

## Input / Output Contract

- **Input**: CLI arguments only.
  - `query` (positional, required): one or more tokens, joined into a single query string.
  - `--max-results` (optional, integer): maximum results per query, default `5`.
  - `--country` (optional, string): ISO country code (`US`, `KR`, etc.).

- **Output**: single JSON object to stdout.

On success:

```json
{
  "ok": true,
  "query": "latest AI news 2026",
  "response": { /* raw Perplexity Search API JSON */ }
}
```

On error:

```json
{
  "ok": false,
  "error": "error message"
}
```

The AI assistant should:

- Invoke the tool with a natural‑language query string.
- Parse stdout as JSON.
- Check `ok`:
  - If `true`, use `response` (especially `response.results`) as search results and citations.
  - If `false`, surface `error` back to the user or log it.

## Usage Notes For This Repo

- Perplexity Search is expensive. Use it only when local evidence or official docs are insufficient.
- Prefer one focused query first. Run a second query only if the first result set is not enough to make a decision.
- Every Perplexity request must be logged under `docs/perplexity/` with:
  - request background
  - exact query text
  - execution timestamp
  - concise result summary
  - source URLs used for the final decision
- Keep the log current in the same work session so later reviewers can audit why the search was worth the cost.
