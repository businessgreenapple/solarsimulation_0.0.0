from flask import Flask, request, jsonify, render_template
from calculation import calculate_simulation

app = Flask(__name__)

# メモリ上で記事を管理
posts = []

@app.route('/')
def index():
    return render_template('simulation_form_1.html')

@app.route('/api/posts', methods=['GET'])
def get_posts():
    return jsonify(posts)

@app.route('/api/posts', methods=['POST'])
def add_post():
    data = request.get_json()
    title = data.get('title')
    content = data.get('content')
    if not title or not content:
        return jsonify({'error': 'タイトルと本文は必須です'}), 400
    post = {'id': len(posts) + 1, 'title': title, 'content': content}
    posts.append(post)
    return jsonify(post), 201

@app.route('/simulation_form')
def simulation_form():
    return render_template('simulation_form_1.html')

# 新しいステップ別ルート
@app.route('/simulation_form_1')
def simulation_form_1():
    return render_template('simulation_form_1.html')

@app.route('/simulation_form_2')
def simulation_form_2():
    return render_template('simulation_form_2.html')

@app.route('/simulation_form_3')
def simulation_form_3():
    return render_template('simulation_form_3.html')

@app.route('/simulation_form_4')
def simulation_form_4():
    return render_template('simulation_form_4.html')

@app.route('/simulation_form_5')
def simulation_form_5():
    return render_template('simulation_form_5.html')

@app.route('/simulation_form_6')
def simulation_form_6():
    return render_template('simulation_form_6.html')

@app.route('/api/simulate', methods=['POST'])
def simulate():
    """太陽光発電シミュレーションAPI"""
    try:
        # フロントエンドから送信されたフォームデータを取得
        form_data = request.get_json()
        
        if not form_data:
            return jsonify({'error': 'フォームデータが送信されていません'}), 400
        
        # シミュレーション計算を実行
        result = calculate_simulation(form_data)
        
        # 計算結果をJSON形式で返却
        return jsonify(result)
        
    except Exception as e:
        print(f"シミュレーションAPIエラー: {e}")
        return jsonify({'error': f'シミュレーション計算中にエラーが発生しました: {str(e)}'}), 500

if __name__ == '__main__':
    app.run(debug=True) 