import csv
import json
import os
import glob
from typing import List, Dict, Any

def convert_csv_to_json(csv_file_path: str, json_file_path: str) -> bool:
    """
    CSVファイルをJSONファイルに変換する
    
    Args:
        csv_file_path: 入力CSVファイルのパス
        json_file_path: 出力JSONファイルのパス
    
    Returns:
        bool: 変換成功時True、失敗時False
    """
    try:
        # CSVファイルを読み込み
        with open(csv_file_path, 'r', encoding='utf-8') as f:
            csv_reader = csv.reader(f)
            rows = list(csv_reader)
        
        if len(rows) < 366:  # ヘッダー + 365日分
            print(f"エラー: ファイルの行数が不足しています。期待: 366行以上, 実際: {len(rows)}行")
            return False
        
        # ヘッダー行を取得
        header = rows[0]
        
        # 各日付の1行目（365日分）を取得
        daily_data = []
        for day in range(1, 366):  # 1日目から365日目
            # 各日は10行のデータがあるので、1行目を取得
            row_index = 1 + (day - 1) * 10  # ヘッダー行(1) + (日-1) * 10
            if row_index < len(rows):
                daily_data.append(rows[row_index])
            else:
                print(f"警告: {day}日目のデータが見つかりません")
                break
        
        # JSONデータを構築
        json_data = {
            "header": header,
            "daily_data": daily_data,
            "total_days": len(daily_data)
        }
        
        # JSONファイルに保存
        with open(json_file_path, 'w', encoding='utf-8') as f:
            json.dump(json_data, f, ensure_ascii=False, indent=2)
        
        return True
        
    except Exception as e:
        print(f"変換エラー {csv_file_path}: {e}")
        return False

def convert_all_csv_files():
    """全CSVファイルをJSONファイルに変換する"""
    # NEDOデータディレクトリのパス
    nedo_dir = "static/nedo/nedo_solar_data"
    
    # CSVファイルのパターンを取得
    csv_pattern = os.path.join(nedo_dir, "hm*year.csv")
    csv_files = glob.glob(csv_pattern)
    
    print(f"変換対象ファイル数: {len(csv_files)}")
    
    success_count = 0
    error_count = 0
    
    for csv_file in csv_files:
        # JSONファイル名を生成
        json_file = csv_file.replace('.csv', '.json')
        
        # 既にJSONファイルが存在する場合はスキップ
        if os.path.exists(json_file):
            print(f"スキップ: {os.path.basename(json_file)} (既に存在)")
            continue
        
        print(f"変換中: {os.path.basename(csv_file)} → {os.path.basename(json_file)}")
        
        if convert_csv_to_json(csv_file, json_file):
            success_count += 1
            print(f"✓ 成功: {os.path.basename(json_file)}")
        else:
            error_count += 1
            print(f"✗ 失敗: {os.path.basename(csv_file)}")
    
    print(f"\n変換完了:")
    print(f"成功: {success_count}件")
    print(f"失敗: {error_count}件")
    print(f"合計: {success_count + error_count}件")

def main():
    """メイン処理"""
    print("全地点のCSV→JSON変換を開始します...")
    convert_all_csv_files()

if __name__ == "__main__":
    main() 