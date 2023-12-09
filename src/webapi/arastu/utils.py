import math
from pathlib import Path
import pandas as pd
import numpy as np
import random
import json
import os
from openai import AzureOpenAI
import re
# ... other necessary imports ...


# Get the directory of the current file (__file__ refers to the current file)
dir_path = os.path.dirname(os.path.realpath(__file__))
# Construct the absolute path to your JSON file
file_path = os.path.join(dir_path, '../static', 'pg_philosophy.json')

df = pd.read_json(file_path)
# Other global variables
tokens = 3000

bcq_setup_text ="You are a Quiz Master. \
                    The user will provide you with a context. You will come up with a Best Choice Question from the context. \
                    Formulate a question which is at most 2 lines long. \
                    Provide 4 choices, with only one best choice. The other 3 choices will not be the best choice for the given question. \
                    Each Choice has a letter identifier (A, B, C, D). \
                    The choice starts with the letter followed by a full stop and then space and then the choice. \
                    The questions should be chosen such that the answers are a few phrase long (7 at most). \
                    When asking the question, avoid mentioning vague references such as According to context. \
                    Never provide the answer with the question. \
                    You will Wait for the User answer. The user will answer with the Letter A, B, C, D corrosponding to the choice. \
                    You will then reply with: The first line should contain 'Correct!' or 'Wrong!' based on the user answer, if the answer is Correct or Wrong. \
                    The second line can contain a short explanation why it is wrong \
                    The answer is only correct if the answer matches the best selction. \
                    e.g. if All of the Above is the best choice, and the user only selects any other choice, the answer is wrong.\
                    The answer is wrong if the user answers with any letter other than A, B, C, D\
                    "

def print_json_values(json_data, depth=1, level=0, list_limit=10):
    """ Recursively prints the keys and values from a JSON object up to a specified depth and list items up to list_limit. """
    if isinstance(json_data, dict):
        for key, value in json_data.items():
            print("  " * level + f"{key}: {value if not isinstance(value, (dict, list)) else ''}")
            if level < depth - 1 and isinstance(value, (dict, list)):
                print_json_values(value, depth, level + 1, list_limit)
    elif isinstance(json_data, list):
        print("  " * level + f"[List with {len(json_data)} items]")
        for i, item in enumerate(json_data):
            if i >= list_limit:
                print("  " * (level + 1) + "...")
                break
            if isinstance(item, (dict, list)):
                print_json_values(item, depth, level + 1, list_limit)
            else:
                print("  " * (level + 1) + str(item))

def limit_text_to_tokens(text, token_limit, tokens_per_word, word_charachter_count, start_index=None, end_index=None):
    words = text.split()  # Split the text into words
    word_limit = math.floor((token_limit * tokens_per_word) / word_charachter_count)

    if start_index is None or end_index is None:
        # Calculate the maximum valid start index
        max_start_index = max(0, len(words) - word_limit)
        # Select a random start index
        start_index = random.randint(0, max_start_index)
        end_index = start_index + word_limit
    else:
        # Ensure the provided indexes are within the range of words
        start_index = max(0, min(start_index, len(words)))
        end_index = max(start_index, min(end_index, len(words)))

    # Select words from the given start index up to the end index
    limited_words = words[start_index:end_index]

    return {
        'start_index': start_index,
        'end_index': end_index,
        'selected_text': ' '.join(limited_words)
    }


def setup_openai():
    # [System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_KEY', 'Key', 'User')
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_KEY"),
        azure_endpoint = "https://genai23-01.openai.azure.com/",
        api_version = "2023-05-15"
    )

    return client

def get_completion(messages, client, model="gpt4", temperature=0, max_tokens=500):
    response = client.chat.completions.create(
        model=model, 
        messages=messages
        )
    return response

client = setup_openai()
model = "gpt-model-02"

def get_question(data):
    # Initialization logic
    # Return the first question

    #df = pd.read_json(file_path)
    
    quiz_length = data['quiz_length']
    current_question = data['current_question']
    score = data['score']

    messages = []
    messages.append({"role": "system", "content": bcq_setup_text})

    study_index = random.randint(0, df.shape[0] - 1)
    study = limit_text_to_tokens(df.iloc[study_index]['content'], tokens, 4, 6)
    messages.append({"role": "user", "content": study['selected_text']})

    question = get_completion(messages, client, model)
    messages.append({"role": "assistant", "content": question})
    current_question = current_question + 1
    #print(question.choices[0].message.content)
    #print(messages)
    response = {
        'question': question.choices[0].message.content,
        'study_index': study_index,
        'start_index': study['start_index'],
        'end_index': study['end_index'],
        'quiz_length': quiz_length,
        'current_question': current_question,
        'score':score
    }

    return response

def submit_answer(data):
    # Process the user input
    messages = []

    study_index = data['study_index']
    start_index = data['start_index']
    end_index = data['end_index']
    score = data['score']

    study = limit_text_to_tokens(df.iloc[study_index]['content'], tokens, 4, 6, start_index, end_index)

    # Return the next question or final score
    messages.extend([
             {"role": "system", "content": bcq_setup_text},
             {"role": "user", "content": study['selected_text']},
             {"role": "assistant", "content": data['question']},
             {"role": "user", "content": "User answer:" + data['answer']}
            ])


    #print("----")
    response = get_completion(messages, client, model)
    print(response.choices[0].message.content)
    print(response.usage)

    # Extract the first line and convert it to lowercase
    first_line_lower = response.choices[0].message.content.split('\n')[0].lower()
    # Split the first line by space and '!' and convert to lowercase
    split_elements = re.split(' |!', first_line_lower)

    if "correct" in split_elements:
        score += 1

    response = {
        'question': data['question'],
        'study_index': study_index,
        'start_index': study['start_index'],
        'end_index': study['end_index'],
        'quiz_length': data['quiz_length'],
        'current_question': data['current_question'],
        'answer_result': response.choices[0].message.content,
        'score':score
    }
    return response

def completed(data):
    score = data['score']
    quiz_length = data['quiz_length']

    score_precentage = score / quiz_length
    humourous_score_setup = f"Generate a humourous (hysterically funny) response, in a philosophical context, for a person who score {score_precentage * 100} in a philosophical quiz. \
        He got {score} questions correct from a total of {quiz_length}. The response should not exceed three lines."

    messages =  [
                    {"role": "system", "content": humourous_score_setup}
                ]

    humourous_reply = get_completion(messages, client, model)

    response = {
        #'question': data['question'],
        #'study_index': data['study_index'],
        'quiz_length': data['quiz_length'],
        'humourous_score': humourous_reply.choices[0].message.content,
        'score':score
    }
    return response