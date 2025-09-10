#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
年間日射量合計の計算方法を検証するスクリプト
"""

import json
import os

def load_nedo_data(location_id: str) -> dict:
    """NEDOデータを読み込み"""
    filename = f"hm{location_id}year.json"
    filepath = os.path.join('static', 'nedo', 'nedo_solar_data', filename)
    
    with open(filepath, 'r', encoding='utf-8') as f:
        return json.load(f)

def calculate_radiation_methods(nedo_data: dict) -> dict:
    """複数の方法で年間日射量合計を計算"""
    results = {}
    
    # 方法1: 24時間分の時間値を合計（現在の方法）
    method1_sum = 0.0
    for day_index in range(365):
        if 'daily_data' not in nedo_data or day_index >= len(nedo_data['daily_data']):
            continue
        daily_row = nedo_data['daily_data'][day_index]
        
        # 0時～23時の日射量を合計（インデックス5～28）
        daily_sum = 0.0
        for hour in range(24):
            if len(daily_row) > 5 + hour:
                try:
                    radiation_value = float(daily_row[5 + hour])
                    daily_sum += radiation_value
                except (ValueError, IndexError):
                    continue
        method1_sum += daily_sum
    
    results['method1_hourly_sum'] = method1_sum
    
    # 方法2: 日合計値を使用（インデックス30）
    method2_sum = 0.0
    for day_index in range(365):
        if 'daily_data' not in nedo_data or day_index >= len(nedo_data['daily_data']):
            continue
        daily_row = nedo_data['daily_data'][day_index]
        
        # 日合計値を使用（インデックス30）
        if len(daily_row) > 30:
            try:
                daily_total = float(daily_row[30])
                method2_sum += daily_total
            except (ValueError, IndexError):
                continue
    
    results['method2_daily_total'] = method2_sum
    
    # サンプルデータの詳細確認
    print("=== サンプルデータ確認 ===")
    for day_index in range(5):  # 最初の5日分
        daily_row = nedo_data['daily_data'][day_index]
        
        # 時間別データを合計
        hourly_sum = 0.0
        hourly_values = []
        for hour in range(24):
            if len(daily_row) > 5 + hour:
                try:
                    value = float(daily_row[5 + hour])
                    hourly_sum += value
                    hourly_values.append(value)
                except:
                    hourly_values.append(0)
        
        # 日合計値
        daily_total = float(daily_row[30]) if len(daily_row) > 30 else 0
        
        print(f"日{day_index + 1}: 時間合計={hourly_sum}, 日合計={daily_total}, 差={abs(hourly_sum - daily_total)}")
        if day_index == 0:
            print(f"  時間別値: {hourly_values[:12]}...")  # 最初の12時間分表示
    
    return results

def main():
    """メイン処理"""
    location_id = "82182"  # 福岡
    
    print(f"=== 福岡（{location_id}）年間日射量合計計算検証 ===")
    
    # NEDOデータ読み込み
    nedo_data = load_nedo_data(location_id)
    print(f"データ読み込み完了 - 日数: {len(nedo_data['daily_data'])}")
    
    # 複数の方法で計算
    results = calculate_radiation_methods(nedo_data)
    
    print("\n=== 計算結果 ===")
    print(f"方法1（時間値合計）: {results['method1_hourly_sum']:,.0f} (0.01MJ/m²)")
    print(f"方法2（日合計値使用）: {results['method2_daily_total']:,.0f} (0.01MJ/m²)")
    print(f"差: {abs(results['method1_hourly_sum'] - results['method2_daily_total']):,.0f}")
    
    print(f"\nユーザー指摘値: 484,192 (0.01MJ/m²)")
    print(f"方法1との差: {abs(results['method1_hourly_sum'] - 484192):,.0f}")
    print(f"方法2との差: {abs(results['method2_daily_total'] - 484192):,.0f}")

if __name__ == "__main__":
    main()
