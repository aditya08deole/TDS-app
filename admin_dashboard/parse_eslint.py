import json

with open('eslint_report_v2.json', 'r', encoding='utf-8') as f:
    data = json.load(f)

errors = []
for file in data:
    for message in file['messages']:
        if message['severity'] >= 1:
            errors.append({
                'filePath': file['filePath'],
                'severity': 'Error' if message['severity'] == 2 else 'Warning',
                'line': message.get('line'),
                'column': message.get('column'),
                'ruleId': message.get('ruleId'),
                'message': message.get('message')
            })

for err in errors:
    print(f"{err['severity']} - {err['filePath']}:{err['line']}:{err['column']} - {err['ruleId']}: {err['message']}")
