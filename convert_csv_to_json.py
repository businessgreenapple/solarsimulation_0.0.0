import csv
import json
import os
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
        
        print(f"変換完了: {csv_file_path} → {json_file_path}")
        print(f"ヘッダー行: 1行")
        print(f"日別データ: {len(daily_data)}日分")
        print(f"合計行数: {len(daily_data) + 1}行")
        
        return True
        
    except Exception as e:
        print(f"変換エラー: {e}")
        return False

def main():
    """メイン処理"""
    # 北茨城のCSVファイルをJSONに変換
    csv_file = "static/nedo/nedo_solar_data/hm40046year.csv"
    json_file = "static/nedo/nedo_solar_data/hm40046year.json"
    
    if os.path.exists(csv_file):
        success = convert_csv_to_json(csv_file, json_file)
        if success:
            print("北茨城のCSV→JSON変換が正常に完了しました。")
        else:
            print("北茨城のCSV→JSON変換に失敗しました。")
    else:
        print(f"エラー: CSVファイルが見つかりません: {csv_file}")

if __name__ == "__main__":
    main() 