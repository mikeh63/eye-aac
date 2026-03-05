from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

@app.route("/")
def index():
    return render_template("index.html")

@app.route("/api/calibrate", methods=["POST"])
def calibrate():
    """Receive calibration data from the frontend tracker."""
    data = request.get_json()
    return jsonify({"status": "ok", "received": data})

if __name__ == "__main__":
    app.run(debug=True, port=5000)
