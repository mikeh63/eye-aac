import os
import json
import anthropic
from flask import Flask, render_template, jsonify, request

app = Flask(__name__)

# Anthropic client — reads ANTHROPIC_API_KEY from environment
client = anthropic.Anthropic(api_key=os.environ.get("ANTHROPIC_API_KEY"))

JACK_SYSTEM_PROMPT = """You are helping Jack, a witty and irreverent man with ALS who uses an AAC 
(Augmentative and Alternative Communication) board to communicate. Jack has a sharp sense of humor, 
uses casual language, occasionally swears, and has a warm personality. His close contacts include 
Theresa (wife), Pam (sister), Mark, Dan, Mike, Ron, and Danai (friends). He loves coffee, Thai food, 
OSU Beavers football, and has strong opinions about tech and robots.

Given the partial sentence Jack has typed so far, suggest the 6 most likely NEXT SINGLE WORDS he 
would want to add. Think about natural word-by-word sentence completion.

Rules:
- Return ONLY a JSON array of exactly 6 strings, nothing else
- Each suggestion must be 1 word only — no phrases, no multi-word suggestions
- Occasionally 2 words are acceptable for natural contractions or names (e.g. "can't", "Theresa")
- Suggest the single most likely next word as if completing the sentence one word at a time
- Include contractions naturally (I'm, can't, won't, that's etc.)
- No punctuation unless it's a natural sentence ending like ? or !
- Vary suggestions — don't give 6 similar words
- Example format: ["really", "so", "coffee", "tired", "Theresa", "great"]"""


@app.route("/")
def index():
    return render_template("index.html")


@app.route("/api/predict", methods=["POST"])
def predict():
    data = request.get_json()
    sentence = data.get("sentence", "").strip()

    if not sentence:
        return jsonify({"suggestions": []})

    try:
        message = client.messages.create(
            model="claude-haiku-4-5-20251001",  # Fast and cheap for predictions
            max_tokens=100,
            system=JACK_SYSTEM_PROMPT,
            messages=[
                {"role": "user", "content": f'Sentence so far: "{sentence}"'}
            ]
        )

        text = message.content[0].text.strip()

        # Strip markdown fences if present
        text = text.replace("```json", "").replace("```", "").strip()
        suggestions = json.loads(text)

        # Ensure exactly 6 suggestions
        suggestions = (suggestions + [""] * 6)[:6]
        return jsonify({"suggestions": suggestions})

    except Exception as e:
        print(f"Prediction error: {e}")
        return jsonify({"suggestions": [], "error": str(e)})


if __name__ == "__main__":
    app.run(debug=True, port=5000)
