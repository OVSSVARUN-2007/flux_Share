import sys
import os
import traceback

# This file is in backend/api/index.py
# We want to add 'backend/' to sys.path so we can import 'main'
backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, backend_dir)

try:
    from main import app
except Exception as e:
    class ErrorLoggerApp:
        async def __call__(self, scope, receive, send):
            await send({
                'type': 'http.response.start',
                'status': 500,
                'headers': [(b'content-type', b'application/json')]
            })
            # JSON escape the traceback manually for basic safety
            trace_safe = traceback.format_exc().replace('\n', '\\n').replace('"', '\\"')
            msg_safe = str(e).replace('"', '\\"')
            await send({
                'type': 'http.response.body',
                'body': f'{{"detail": "{msg_safe}", "trace": "{trace_safe}"}}'.encode('utf-8')
            })
    app = ErrorLoggerApp()
