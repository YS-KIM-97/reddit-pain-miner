.PHONY: install test lint doctor demo research-demo web-install web-dev web-build clean

install:
	python -m pip install -e '.[dev]'

test:
	pytest

lint:
	ruff check .

doctor:
	reddit-pain doctor

demo:
	reddit-pain run --offline --input examples/sample_signals.json
	reddit-pain prd --offline --idea-id idea-1

research-demo:
	reddit-pain scenario

web-install:
	cd web && npm run install:ci

web-dev:
	cd web && CODEX_SANDBOX=seatbelt npm run dev -- --hostname 127.0.0.1

web-build:
	cd web && npm run lint && npx tsc --noEmit && npm run build

clean:
	rm -rf build dist .pytest_cache .ruff_cache
