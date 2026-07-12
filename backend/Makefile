## Backend convenience commands
##
## Usage:
##   make start # run API locally (reload)
##   make stop  # stop the running uvicorn
##   make help  # list targets

.PHONY: help start dev stop restart requirements deploy deploy-logs railway-link stripe-webhooks

requirements:
	@if command -v poetry >/dev/null 2>&1; then \
	  poetry export -f requirements.txt --output requirements.txt --without-hashes; \
	  echo "Wrote requirements.txt"; \
	else \
	  echo "ERROR: Poetry is required to export requirements.txt"; \
	  exit 1; \
	fi

help:
	@echo "Eventtz backend"
	@echo ""
	@echo "Targets:"
	@echo "  make start    Run FastAPI (uvicorn --reload)"
	@echo "  make dev      Alias for make start"
	@echo "  make stop     Stop running uvicorn for app.main:app"
	@echo "  make restart  Stop then start"
	@echo "  make requirements  Regenerate requirements.txt from poetry.lock (Railway deploy)"
	@echo "  make deploy       Deploy to Railway (railway up --detach)"
	@echo "  make deploy-logs    Tail Railway deployment logs"
	@echo "  make railway-link   Link this folder to a Railway project (railway link)"
	@echo "  make stripe-webhooks  Forward Stripe webhooks to localhost:8000 (run in a second terminal)"

start:
	@if command -v poetry >/dev/null 2>&1; then \
	  poetry run uvicorn app.main:app --reload --host 0.0.0.0; \
	elif python -c "import uvicorn" >/dev/null 2>&1; then \
	  python -m uvicorn app.main:app --reload --host 0.0.0.0; \
	else \
	  echo "ERROR: Can't run the API because dependencies aren't available."; \
	  echo "Install uvicorn (and other deps) or install Poetry and run: poetry install"; \
	  exit 1; \
	fi

dev: start

stop:
	@# Uvicorn reload mode spawns a reloader parent + worker child.
	@# We try a few common patterns to catch both, without failing if nothing matches.
	@pkill -f "uvicorn.*app\.main:app" 2>/dev/null || true
	@pkill -f "python.*-m uvicorn.*app\.main:app" 2>/dev/null || true
	@pkill -f "poetry.*run.*uvicorn.*app\.main:app" 2>/dev/null || true
	@# Fallback: if something is still listening on the default port, kill it.
	@# macOS has lsof by default.
	@pids="$$(lsof -tiTCP:8000 -sTCP:LISTEN 2>/dev/null || true)"; \
	if [ -n "$$pids" ]; then \
	  echo "$$pids" | while read -r pid; do \
	    if [ -n "$$pid" ]; then \
	      echo "Killing PID $$pid on port 8000"; \
	      kill -TERM "$$pid" 2>/dev/null || true; \
	      for i in 1 2 3 4 5 6; do \
	        if kill -0 "$$pid" 2>/dev/null; then \
	          sleep 0.25; \
	        else \
	          break; \
	        fi; \
	      done; \
	      if kill -0 "$$pid" 2>/dev/null; then \
	        echo "PID $$pid still alive; force killing"; \
	        kill -KILL "$$pid" 2>/dev/null || true; \
	      fi; \
	    fi; \
	  done; \
	fi
	@# Wait briefly for the port to be released to avoid racing a restart.
	@for i in 1 2 3 4 5 6 7 8 9 10; do \
	  if lsof -tiTCP:8000 -sTCP:LISTEN >/dev/null 2>&1; then \
	    sleep 0.2; \
	  else \
	    break; \
	  fi; \
	done
	@echo "Stop attempted (pattern + port fallback)."

restart: stop start

deploy:
	@if command -v railway >/dev/null 2>&1; then \
	  railway up --detach; \
	else \
	  echo "ERROR: Railway CLI not found. Install: brew install railway"; \
	  echo "       or: npm install -g @railway/cli"; \
	  exit 1; \
	fi

deploy-logs:
	@railway logs

railway-link:
	@railway link

railway-vars:
	@./scripts/sync-railway-env.sh

stripe-webhooks:
	@if command -v stripe >/dev/null 2>&1; then \
	  echo "Forwarding Stripe webhooks to http://localhost:8000/api/v1/webhooks/stripe"; \
	  echo "Copy the whsec_... secret into STRIPE_WEBHOOK_SECRET in .env, then restart the API."; \
	  stripe listen --forward-to localhost:8000/api/v1/webhooks/stripe; \
	else \
	  echo "ERROR: Stripe CLI not found. Install: brew install stripe/stripe-cli/stripe"; \
	  exit 1; \
	fi

