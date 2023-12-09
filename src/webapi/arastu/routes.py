from flask import request, jsonify
import json
from arastu import app
from arastu.utils import get_question, submit_answer, completed

@app.route('/')
def index():
    return "Welcome to the Quiz API!"

@app.route('/question', methods=['POST'])
def get_question_route():
    try:
        data = request.json
        quiz_length = data['quiz_length']
        current_question = data['current_question']
        response = None

        if current_question < quiz_length:
            response = get_question(data)
        else:
            response = completed(data) # return score + humourous.

        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/answer', methods=['POST'])
def submit_answer_route():
    try:
        data = request.json
        response = submit_answer(data)
        return jsonify(response)
    except Exception as e:
        return jsonify({'error': str(e)}), 500