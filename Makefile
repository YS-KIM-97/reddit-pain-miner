.PHONY: install test lint doctor demo research-demo clean

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

clean:
	rm -rf build dist .pytest_cache .ruff_cache
