from pathlib import Path
import pandas as pd
import numpy as np
import random
import json
import os
from openai import AzureOpenAI
import re

base_path = Path(__file__).parent.parent.parent
#print(base_path)

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

def limit_text_to_tokens(text, token_limit, tokens_per_word):
    word_limit = token_limit // tokens_per_word
    words = text.split()  # Split the text into words
    limited_words = words[:word_limit]  # Take the first 'word_limit' words
    return ' '.join(limited_words)  # Join them back into a string

def limit_text_to_tokens_randomly(text, token_limit, tokens_per_word):
    word_limit = token_limit // tokens_per_word
    words = text.split()  # Split the text into words

    # Calculate the maximum valid start index
    max_start_index = max(0, len(words) - word_limit)
    # Select a random start index
    start_index = random.randint(0, max_start_index)

    # Select words from the random start index
    limited_words = words[start_index:start_index + word_limit]

    return ' '.join(limited_words)

def setup_openai():
    # [System.Environment]::SetEnvironmentVariable('AZURE_OPENAI_KEY', 'Key', 'User')
    client = AzureOpenAI(
        api_key=os.getenv("AZURE_OPENAI_KEY"),
        azure_endpoint = "https://genai23-01.openai.azure.com/",
        api_version = "2023-05-15"
    )

    print(os.getenv("AZURE_OPENAI_KEY"))
    return client

def get_completion(messages, client, model="gpt4", temperature=0, max_tokens=500):
    response = client.chat.completions.create(
        model=model, 
        messages=messages
        )
    return response

def main(file_path):

    try:
        df = pd.read_json(file_path)
        client = setup_openai()
        model = "gpt-model-02"
        tokens = 8000
        quiz_length = 3
        score = 0
        score_precentage = 0
        humourous_score_reponse = ""
        #followed by a new line with 3 dash charachters and another new line. 
        bcq_setup_text ="You are a Quiz Master. \
                        The user will provide you with a context. You will come up with a Best Choice Question from the context. \
                        Formulate a question which is at most 2 lines long. Follow it by two new lines\
                        Provide 4 choices, with only one best choice. The other 3 choices will not be the best choice for the given question. \
                        Each Choice has a letter identifier (A, B, C, D). \
                        The choice starts with the letter followed by a full stop and then space and then the choice. \
                        The questions should be chosen such that the answers are a few phrase long (7 at most). \
                        Never provide the answer with the question. \
                        You will Wait for the User answer. The user will answer with the Letter A, B, C, D corrosponding to the choice. \
                        You will then reply with: The first line should contain 'Correct!' or 'Wrong!' based on the user answer, if the answer is Correct or Wrong. \
                        The second line can contain a short explanation why it is wrong \
                        The answer is only correct if the answer matches the best selction. \
                        e.g. if All of the Above is the best choice, and the user only selects any other choice, the answer is wrong.\
                        "
        for i in range (quiz_length):
            messages = []
            messages.append({"role": "system", "content": bcq_setup_text})

            study_index = random.randint(0, df.shape[0] - 1)
            study = limit_text_to_tokens_randomly(df.iloc[study_index]['content'], tokens, 4)
            messages.append({"role": "user", "content": study})

            response = get_completion(messages, client, model)
            print("-----------------------")
            print(df.iloc[study_index]['title'])
            print(response.choices[0].message.content)
            #print(response.usage)
            print("----")
            user_input = ""
            while True:
                user_input = input("Enter your answer: ")
                if len(user_input) >= 1:
                    break  # Break out of the loop if input is at least one letter long
                else:
                    print("Input too short. Please try again.")

            reply = [{"role": "assistant", "content": response.choices[0].message.content},
                    {"role": "user", "content": "User answer:" + user_input}
                    ]
            messages.extend(reply)
            print("----")
            response = get_completion(messages, client, model)
            print(response.choices[0].message.content)
            print(response.usage)

            # Extract the first line and convert it to lowercase
            first_line_lower = response.choices[0].message.content.split('\n')[0].lower()
            # Split the first line by space and '!' and convert to lowercase
            split_elements = re.split(' |!', first_line_lower)

            if "correct" in split_elements:
                score += 1

            print("-----------------------")
        
        score_precentage = score / quiz_length
        humourous_score_setup = f"Generate a humourous (hysterically funny) response, in a philosophical context, for a person who score {score_precentage * 100} in a philosophical quiz. \
            He got {score} questions correct from a total of {quiz_length}. The response should not exceed three lines."

        messages =  [
                        {"role": "system", "content": humourous_score_setup}
                    ]

        response = get_completion(messages, client, model)
        print(response.choices[0].message.content)
        # print(response.usage)
        print("----")

    except Exception as e:
        print(f"Error: {e}")

# Specify the JSON file path and the depth you want to view
file_path = (base_path /'../genaihack23/usecases/QCRI/pg_philosophy/pg_philosophy.json').resolve()  # Replace with your JSON file path
depth = 3  # You can change this to see more or less levels

main(file_path)
