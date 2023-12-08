import json

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

def main(file_path, depth, list_limit):
    try:
        with open(file_path, 'r') as file:
            data = json.load(file)
            print_json_values(data, depth, 0, list_limit)
    except Exception as e:
        print(f"Error: {e}")

# Specify the JSON file path and the depth you want to view
file_path = 'usecases/QCRI/pg_philosophy.json/pg_philosophy.json'  # Replace with your JSON file path
depth = 3  # You can change this to see more or less levels

main(file_path, depth, list_limit = 2)
