import sys
import os
import traceback

# Add the 'backend' folder to the Python path
# This file is at the root 'api/index.py'
current_dir = os.path.dirname(os.path.abspath(__file__))
project_root = os.path.dirname(current_dir)
backend_path = os.path.join(project_root, "backend")

if backend_path not in sys.path:
    sys.path.insert(0, backend_path)

try:
    # Attempt to import the actual FastAPI app
    from main import app
except Exception as e:
    # If the backend fails to load (due to DB connectivity or missing env vars),
    # we return a fallback app that outputs the error message.
    from fastapi import FastAPI
    from fastapi.responses import JSONResponse
    
    app = FastAPI()
    
    @app.get("/{catchall:path}")
    async def error_fallback(catchall: str):
        return JSONResponse(
            status_code=500,
            content={
                "detail": f"Backend failed to initialize: {str(e)}",
                "traceback": traceback.format_exc()
            }
        )
