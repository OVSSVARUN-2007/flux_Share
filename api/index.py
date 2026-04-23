import sys
import os
import traceback
from fastapi import FastAPI

# Static definition to ensure Vercel detection always works
app = FastAPI()
application = app

# Add 'backend' to path
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_path = os.path.join(project_root, "backend")
if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    from main import app as local_app
    app = local_app
    application = app
except Exception as e:
    # Error state: replace the logic of 'app' with an error handler
    from fastapi.responses import JSONResponse
    @app.get("/{catchall:path}")
    async def error_fallback(catchall: str):
        return JSONResponse(
            status_code=500,
            content={
                "detail": "Vercel Boot Error",
                "error": str(e),
                "trace": traceback.format_exc()
            }
        )
