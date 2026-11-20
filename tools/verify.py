import sqlite3, pathlib, json
root=pathlib.Path(__file__).resolve().parents[1]
conn=sqlite3.connect(root/'database/starter.sqlite')
row=conn.execute('select payload,revision from app_state where id=1').fetchone()
assert row and json.loads(row[0])=={'opening':0,'entries':[],'pending':[],'cars':[]} and row[1]==0
html=(root/'public/index.html').read_text()
for term in ['Day Book','Pending Rooms','Car Rounds','Import Data','/api/','authLayer']:
 assert term in html,term
print('OK: SQLite starter and app frontend checks passed')
