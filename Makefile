.PHONY: install test lint doctor demo clean

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

clean:
	rm -rf build dist .pytest_cache .ruff_cache
