import json
import os
import csv
from typing import Dict, Any, Optional

def load_json_data(filename: str) -> Dict[str, Any]:
    """JSONファイルを読み込む"""
    try:
        filepath = os.path.join('static', filename)
        with open(filepath, 'r', encoding='utf-8') as f:
            return json.load(f)
    except Exception as e:
        print(f"JSONファイル読み込みエラー {filename}: {e}")
        return {}

def extract_location_id(location_name: str) -> str:
    """地点名から地点IDを抽出"""
    try:
        # 地点名の形式: "北茨城（40046）" から "40046" を抽出
        # 全角括弧と半角括弧の両方に対応
        if ('（' in location_name and '）' in location_name):
            # 全角括弧の場合
            start = location_name.find('（') + 1
            end = location_name.find('）')
            if start < end:  # 有効な範囲かチェック
                location_id = location_name[start:end]
                # 数字のみかチェック
                if location_id.isdigit():
                    return location_id
        elif ('(' in location_name and ')' in location_name):
            # 半角括弧の場合
            start = location_name.find('(') + 1
            end = location_name.find(')')
            if start < end:  # 有効な範囲かチェック
                location_id = location_name[start:end]
                # 数字のみかチェック
                if location_id.isdigit():
                    return location_id
        return ""
    except Exception as e:
        print(f"地点ID抽出エラー: {e}")
        return ""

def get_nedo_data_file_path(location_id: str, azimuth_angle: int, tilt_angle: int) -> str:
    """NEDOデータファイルのパスを生成"""
    try:
        # JSONファイル名の形式: hm{地点ID}year.json
        # 例: hm40046year.json (地点ID:40046)
        filename = f"hm{location_id}year.json"
        return os.path.join('static', 'nedo', 'nedo_solar_data', filename)
    except Exception as e:
        print(f"NEDOデータファイルパス生成エラー: {e}")
        return ""

def get_temperature_coefficient(month: int) -> float:
    """月別温度係数を取得"""
    if month in [12, 1, 2]:
        return 0.98
    elif month in [3, 4, 5, 6]:
        return 0.93
    elif month in [7, 8]:
        return 0.88
    elif month in [9, 10, 11]:
        return 0.93
    else:
        return 0.93  # デフォルト値

def get_installation_coefficient(installation_face: str, tilt_angle: int) -> float:
    """設置面と傾斜角度から係数を取得"""
    try:
        coefficients_data = load_json_data('installation_coefficients.json')
        if coefficients_data and 'coefficients' in coefficients_data:
            face_coefficients = coefficients_data['coefficients'].get(installation_face, {})
            return face_coefficients.get(str(tilt_angle), 1.0)  # デフォルト値: 1.0
        return 1.0
    except Exception as e:
        print(f"設置面係数取得エラー: {e}")
        return 1.0

def calculate_hourly_generation_with_nedo(form_data: Dict[str, Any]) -> tuple:
    """
    1時間単位の発電量計算（新しいロジック）
    
    Returns:
        tuple: (monthly_generation, annual_generation, hourly_generation_array)
        - monthly_generation: 12ヶ月分の月別発電量リスト
        - annual_generation: 年間発電量
        - hourly_generation_array: 8760時間分の1時間ごとの発電量配列
    """
    try:
        # 必要なデータを読み込み
        module_data = load_json_data('module_data.json')
        inverter_data = load_json_data('inverter_data.json')
        
        # 地点情報を取得
        location = form_data.get('location', '')
        print(f"デバッグ - 受信した地点データ: '{location}'")
        location_id = extract_location_id(location)
        print(f"デバッグ - 抽出した地点ID: '{location_id}'")
        
        if not location_id:
            print("地点IDが取得できません")
            return [0] * 12, 0, [0] * 8760
        
        # モジュール情報を取得
        module_model = form_data.get('moduleModel', '')
        module_quantity = int(form_data.get('moduleQuantity', 0))
        
        print(f"デバッグ - モジュール情報:")
        print(f"  型式: '{module_model}'")
        print(f"  枚数: {module_quantity}")
        
        # モジュールデータから定格出力を取得
        module_power = 0
        if module_data and 'modules' in module_data:
            print(f"デバッグ - モジュールデータ読み込み済み、件数: {len(module_data['modules'])}")
            for module in module_data['modules']:
                if module.get('model') == module_model:
                    module_power = module.get('nominal_power', 0)  # W
                    print(f"デバッグ - 見つかったモジュール定格出力: {module_power}W")
                    break
            if module_power == 0:
                print(f"デバッグ - モジュール '{module_model}' が見つかりませんでした")
        else:
            print("デバッグ - モジュールデータが読み込まれていません")
        
        # モジュール容量(kW)を計算
        module_capacity = (module_power * module_quantity) / 1000
        print(f"デバッグ - 計算されたモジュール容量: {module_capacity}kW")
        
        # パワーコンディショナ情報を取得
        inverter_model = form_data.get('inverterModel', '')
        inverter_quantity = int(form_data.get('inverterQuantity', 1))
        string_configuration = form_data.get('stringConfiguration', {})
        
        print(f"デバッグ - パワーコンディショナ情報:")
        print(f"  型式: '{inverter_model}'")
        print(f"  台数: {inverter_quantity}")
        print(f"  ストリング構成: {string_configuration}")
        
        inverter_efficiency = 0.95  # デフォルト値
        
        # インバータデータから効率を取得
        if inverter_data and 'inverters' in inverter_data:
            for inverter in inverter_data['inverters']:
                if inverter.get('model_name') == inverter_model:
                    inverter_efficiency = inverter.get('efficiency', 0.95)
                    print(f"デバッグ - インバータ効率: {inverter_efficiency}")
                    break
        
        # 設置角度と方位を取得
        roof_angle = form_data.get('roofAngle', '')
        installation_face = form_data.get('installationFace', '')
        
        # 傾斜角度を数値に変換
        tilt_angle = 30  # デフォルト値
        if roof_angle:
            try:
                tilt_angle = int(roof_angle.replace('度', ''))
            except:
                tilt_angle = 30
        
        # 方位角を設定（設置面から推定）
        azimuth_angle = 180  # デフォルト: 南向き
        if installation_face == '南面':
            azimuth_angle = 180
        elif installation_face == '東面':
            azimuth_angle = 90
        elif installation_face == '西面':
            azimuth_angle = 270
        elif installation_face == '北面':
            azimuth_angle = 0
        
        # NEDOデータファイルパスを取得
        nedo_file_path = get_nedo_data_file_path(location_id, azimuth_angle, tilt_angle)
        
        # JSONファイルが存在しない場合はエラー
        if not os.path.exists(nedo_file_path):
            print(f"NEDOデータファイルが見つかりません: {nedo_file_path}")
            return [0] * 12, 0, [0] * 8760
        
        # NEDOデータを読み込み
        nedo_data = {}
        try:
            with open(nedo_file_path, 'r', encoding='utf-8') as f:
                nedo_data = json.load(f)
        except Exception as e:
            print(f"NEDOデータ読み込みエラー: {e}")
            return [0] * 12, 0, [0] * 8760
        
        # 設置面傾斜係数を取得
        installation_coefficient = get_installation_coefficient(installation_face, tilt_angle)
        
        # システム効率係数
        system_efficiency = 0.95
        
        # 月別日数（閏年は考慮しない）
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        
        # 月別発電量を格納する配列
        monthly_generation = [0.0] * 12
        
        # 1時間ごとの発電量を格納する配列（8760時間分）
        hourly_generation_array = [0.0] * 8760
        
        # ステップA: 1時間ごとの発電量を計算（8760時間分）
        day_count = 0
        hour_count = 0
        
        print(f"デバッグ - 発電量計算開始: モジュール容量={module_capacity}kW")
        
        for month in range(12):
            for day in range(days_in_month[month]):
                if day_count >= 365:
                    break
                    
                if 'daily_data' not in nedo_data or day_count >= len(nedo_data['daily_data']):
                    print(f"日別データが見つかりません: 日{day_count + 1}")
                    day_count += 1
                    continue
                    
                daily_row = nedo_data['daily_data'][day_count]
                
                # 24時間分のデータを処理
                for hour in range(24):
                    # インデックス4-27が0-23時の日射量データ
                    if len(daily_row) > 27:
                        try:
                            # その時間の日射量を取得（0.01MJ/m²単位）
                            hourly_radiation = float(daily_row[4 + hour])
                            
                            # 欠損値チェック（8888は欠損値）
                            if hourly_radiation != 8888:
                                # 月別温度損失係数を取得
                                temperature_coefficient = get_temperature_coefficient(month + 1)
                                
                                # 1時間あたりの発電量計算
                                # 計算式: システム容量(kW) × 1時間あたりの日射量(kWh/m²) × 損失係数(K)
                                # 0.01MJ/m²をkWh/m²に変換: 0.01 / 3.6
                                hourly_generation = (module_capacity * 
                                                   hourly_radiation * 0.01 / 3.6 * 
                                                   inverter_efficiency * 
                                                   temperature_coefficient * 
                                                   system_efficiency * 
                                                   installation_coefficient)
                                
                                # 1時間ごとの発電量配列に格納
                                hourly_generation_array[hour_count] = hourly_generation
                                
                                # 月別発電量に加算
                                monthly_generation[month] += hourly_generation
                                
                        except (ValueError, IndexError) as e:
                            print(f"時間別データ処理エラー: 日{day_count + 1}, 時間{hour}: {e}")
                            continue
                    
                    hour_count += 1
                
                day_count += 1
        
        print(f"デバッグ - 発電量計算完了: hour_count={hour_count}, day_count={day_count}")
        
        # 月別発電量を整数に丸める
        monthly_generation = [round(gen, 0) for gen in monthly_generation]
        
        # ステップB: 年間発電量を月別発電量の合計として計算
        annual_generation = sum(monthly_generation)
        
        print(f"デバッグ - 月別発電量: {monthly_generation}")
        print(f"デバッグ - 年間発電量: {annual_generation}")
        print(f"デバッグ - 発電量配列の最初の10要素: {hourly_generation_array[:10]}")
        print(f"デバッグ - 発電量配列の合計: {sum(hourly_generation_array):.3f}kWh")
        
        # 時間別平均発電量を計算（0時～23時）
        hourly_average_generation = [0.0] * 24
        for hour in range(24):
            # 1年分の同じ時間帯の発電量を合計
            total_hour_generation = 0.0
            count = 0
            for day in range(365):
                if day * 24 + hour < len(hourly_generation_array):
                    total_hour_generation += hourly_generation_array[day * 24 + hour]
                    count += 1
            
            # 平均を計算（365日で割る）
            if count > 0:
                hourly_average_generation[hour] = total_hour_generation / 365
        
        print(f"デバッグ - 時間別平均発電量: {[round(gen, 3) for gen in hourly_average_generation]}")
        
        return monthly_generation, annual_generation, hourly_generation_array, hourly_average_generation
        
    except Exception as e:
        print(f"1時間単位発電量計算エラー: {e}")
        return [0] * 12, 0, [0] * 8760, [0] * 24

def calculate_self_consumption(form_data: Dict[str, Any], hourly_generation_array: list) -> tuple:
    """
    時間単位の自家消費量計算
    
    Args:
        form_data: フォームデータ
        hourly_generation_array: 8760時間分の1時間ごとの発電量配列
    
    Returns:
        tuple: (annual_self_consumption, annual_sell_electricity, hourly_consumption_array)
        - annual_self_consumption: 年間自家消費量 (kWh)
        - annual_sell_electricity: 年間売電量 (kWh)
        - hourly_consumption_array: 8760時間分の1時間ごとの消費電力配列
    """
    try:
        # ステップA: 1年分（8760時間）の「消費電力」を算出
        
        # 12ヶ月分の電気使用量データを取得
        monthly_usage = []
        month_keys = ['usage_jan', 'usage_feb', 'usage_mar', 'usage_apr', 'usage_may', 'usage_jun',
                     'usage_jul', 'usage_aug', 'usage_sep', 'usage_oct', 'usage_nov', 'usage_dec']
        
        print(f"デバッグ - フォームデータのキー一覧: {list(form_data.keys())}")
        
        for i, usage_key in enumerate(month_keys):
            usage_value = form_data.get(usage_key, 0)
            print(f"デバッグ - {usage_key}: {usage_value}")
            try:
                monthly_usage.append(float(usage_value))
            except (ValueError, TypeError):
                monthly_usage.append(0.0)
        
        print(f"デバッグ - 月別使用量: {monthly_usage}")
        print(f"デバッグ - 月別使用量の合計: {sum(monthly_usage):.1f}kWh")
        
        # 電気使用形態を取得
        usage_pattern = form_data.get('usagePattern', '昼型')
        print(f"デバッグ - 電気使用形態: {usage_pattern}")
        
        # 使用パターンのJSONデータを読み込み
        usage_patterns_data = load_json_data('usage_patterns.json')
        if not usage_patterns_data or usage_pattern not in usage_patterns_data:
            print(f"使用パターンデータが見つかりません: {usage_pattern}")
            return 0, 0, [0] * 8760
        
        # 24時間の使用割合を取得
        hourly_ratios = usage_patterns_data[usage_pattern]
        print(f"デバッグ - 24時間使用割合: {hourly_ratios}")
        
        # 月別日数（閏年は考慮しない）
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        
        # 1時間ごとの消費電力配列（8760時間分）
        hourly_consumption_array = [0.0] * 8760
        
        # 各月の1日あたりの平均使用量を計算し、24時間ごとの使用割合に応じて振り分け
        hour_count = 0
        for month in range(12):
            # その月の1日あたりの平均使用量を計算
            days_in_this_month = days_in_month[month]
            monthly_total = monthly_usage[month]
            daily_average = monthly_total / days_in_this_month if days_in_this_month > 0 else 0
            
            print(f"デバッグ - 月{month + 1}: 月間使用量={monthly_total}kWh, 日数={days_in_this_month}, 1日平均={daily_average}kWh")
            
            # その月の各日について24時間分の消費電力を計算
            for day in range(days_in_this_month):
                for hour in range(24):
                    if hour_count < 8760:
                        # その時間の消費電力 = 1日あたりの平均使用量 × その時間の使用割合
                        hourly_consumption = daily_average * hourly_ratios[hour]
                        hourly_consumption_array[hour_count] = hourly_consumption
                        hour_count += 1
        
        print(f"デバッグ - 消費電力配列作成完了: {hour_count}時間分")
        
        # デバッグ: 配列の状態を確認
        print(f"デバッグ - 発電量配列の最初の10要素: {hourly_generation_array[:10]}")
        print(f"デバッグ - 消費量配列の最初の10要素: {hourly_consumption_array[:10]}")
        print(f"デバッグ - 発電量配列の合計: {sum(hourly_generation_array):.3f}kWh")
        print(f"デバッグ - 消費量配列の合計: {sum(hourly_consumption_array):.3f}kWh")
        
        # ステップB: 1年分（8760時間）の「発電電力」は既に取得済み（hourly_generation_array）
        
        # ステップC: 年間自家消費量の算出
        annual_self_consumption = 0.0
        annual_sell_electricity = 0.0
        
        # デバッグ: 1月1日0時の計算例を表示
        print(f"デバッグ - 1月1日0時の計算例:")
        print(f"  発電量: {hourly_generation_array[0]:.3f}kWh")
        print(f"  消費量: {hourly_consumption_array[0]:.3f}kWh")
        print(f"  自家消費量: {min(hourly_generation_array[0], hourly_consumption_array[0]):.3f}kWh")
        print(f"  売電量: {max(0, hourly_generation_array[0] - hourly_consumption_array[0]):.3f}kWh")
        
        # デバッグ: 1月1日12時の計算例を表示（日中）
        print(f"デバッグ - 1月1日12時の計算例:")
        print(f"  発電量: {hourly_generation_array[12]:.3f}kWh")
        print(f"  消費量: {hourly_consumption_array[12]:.3f}kWh")
        print(f"  自家消費量: {min(hourly_generation_array[12], hourly_consumption_array[12]):.3f}kWh")
        print(f"  売電量: {max(0, hourly_generation_array[12] - hourly_consumption_array[12]):.3f}kWh")
        
        for hour in range(8760):
            consumption = hourly_consumption_array[hour]
            generation = hourly_generation_array[hour]
            
            # 各時間において、「消費電力」と「発電電力」のうち、小さい方の値がその時間の「自家消費量」
            self_consumption = min(consumption, generation)
            annual_self_consumption += self_consumption
            
            # 売電量 = 発電量 - 自家消費量（負の値の場合は0）
            sell_electricity = max(0, generation - consumption)
            annual_sell_electricity += sell_electricity
        
        print(f"デバッグ - 年間自家消費量: {annual_self_consumption}kWh")
        print(f"デバッグ - 年間売電量: {annual_sell_electricity}kWh")
        print(f"デバッグ - 年間発電量: {sum(hourly_generation_array):.0f}kWh")
        print(f"デバッグ - 年間消費量: {sum(hourly_consumption_array):.0f}kWh")
        
        return round(annual_self_consumption, 0), round(annual_sell_electricity, 0), hourly_consumption_array
        
    except Exception as e:
        print(f"自家消費量計算エラー: {e}")
        return 0, 0, [0] * 8760

def calculate_daily_hourly_data(hourly_generation_array: list, hourly_consumption_array: list) -> tuple:
    """
    1日の時間別自家消費量と売電量を計算
    
    Args:
        hourly_generation_array: 8760時間分の1時間ごとの発電量配列
        hourly_consumption_array: 8760時間分の1時間ごとの消費電力配列
    
    Returns:
        tuple: (hourly_self_consumption, hourly_surplus_power)
        - hourly_self_consumption: 24時間分の自家消費量配列
        - hourly_surplus_power: 24時間分の売電量配列
    """
    try:
        # 1日分（24時間）のデータを格納する配列
        hourly_self_consumption = [0.0] * 24
        hourly_surplus_power = [0.0] * 24
        
        # 365日分のデータを24時間ごとに集計
        for day in range(365):
            for hour in range(24):
                # その日のその時間のインデックス
                index = day * 24 + hour
                
                if index < len(hourly_generation_array) and index < len(hourly_consumption_array):
                    generation = hourly_generation_array[index]
                    consumption = hourly_consumption_array[index]
                    
                    # その時間の自家消費量 = min(発電量, 消費量)
                    self_consumption = min(generation, consumption)
                    hourly_self_consumption[hour] += self_consumption
                    
                    # その時間の売電量 = max(0, 発電量 - 消費量)
                    surplus = max(0, generation - consumption)
                    hourly_surplus_power[hour] += surplus
        
        # 365日分の平均を計算
        hourly_self_consumption = [value / 365 for value in hourly_self_consumption]
        hourly_surplus_power = [value / 365 for value in hourly_surplus_power]
        
        print(f"デバッグ - 1日平均自家消費量: {hourly_self_consumption}")
        print(f"デバッグ - 1日平均売電量: {hourly_surplus_power}")
        
        return hourly_self_consumption, hourly_surplus_power
        
    except Exception as e:
        print(f"1日時間別データ計算エラー: {e}")
        return [0.0] * 24, [0.0] * 24

def calculate_seasonal_daily_power_flow(hourly_generation_array: list, hourly_consumption_array: list) -> dict:
    """
    季節別の1日の電力の流れを計算
    
    Args:
        hourly_generation_array: 8760時間分の1時間ごとの発電量配列
        hourly_consumption_array: 8760時間分の1時間ごとの消費電力配列
    
    Returns:
        dict: 季節別の1日の電力の流れデータ
    """
    try:
        # 季節の定義（月別）
        seasons = {
            'spring': [3, 4, 5],    # 春（3-5月）
            'summer': [6, 7, 8],    # 夏（6-8月）
            'autumn': [9, 10, 11],  # 秋（9-11月）
            'winter': [12, 1, 2]    # 冬（12-2月）
        }
        
        # 月別日数（閏年は考慮しない）
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        
        seasonal_data = {}
        
        for season_name, months in seasons.items():
            # 各季節の24時間分のデータを格納する配列
            hourly_self_consumption = [0.0] * 24
            hourly_surplus_power = [0.0] * 24
            hourly_generation = [0.0] * 24
            day_count = 0
            
            # その季節の日数を計算
            season_days = 0
            
            for month in months:
                # 月の開始日と終了日を計算
                month_start_day = sum(days_in_month[:month-1]) if month > 1 else 0
                month_end_day = month_start_day + days_in_month[month-1]
                
                for day in range(month_start_day, month_end_day):
                    if day >= 365:  # 365日を超えた場合は終了
                        break
                        
                    season_days += 1
                    
                    for hour in range(24):
                        # その日のその時間のインデックス
                        index = day * 24 + hour
                        
                        if index < len(hourly_generation_array) and index < len(hourly_consumption_array):
                            generation = hourly_generation_array[index]
                            consumption = hourly_consumption_array[index]
                            
                            # その時間のデータを累積
                            hourly_generation[hour] += generation
                            
                            # その時間の自家消費量 = min(発電量, 消費量)
                            self_consumption = min(generation, consumption)
                            hourly_self_consumption[hour] += self_consumption
                            
                            # その時間の売電量 = max(0, 発電量 - 消費量)
                            surplus = max(0, generation - consumption)
                            hourly_surplus_power[hour] += surplus
            
            # その季節の日数で平均を計算
            if season_days > 0:
                hourly_generation = [value / season_days for value in hourly_generation]
                hourly_self_consumption = [value / season_days for value in hourly_self_consumption]
                hourly_surplus_power = [value / season_days for value in hourly_surplus_power]
            
            seasonal_data[season_name] = {
                'generation': [round(value, 3) for value in hourly_generation],
                'self_consumption': [round(value, 3) for value in hourly_self_consumption],
                'surplus_power': [round(value, 3) for value in hourly_surplus_power],
                'days': season_days
            }
        
        print(f"デバッグ - 季節別1日の電力の流れ: {seasonal_data}")
        return seasonal_data
        
    except Exception as e:
        print(f"季節別1日の電力の流れ計算エラー: {e}")
        return {
            'spring': {'generation': [0.0] * 24, 'self_consumption': [0.0] * 24, 'surplus_power': [0.0] * 24, 'days': 0},
            'summer': {'generation': [0.0] * 24, 'self_consumption': [0.0] * 24, 'surplus_power': [0.0] * 24, 'days': 0},
            'autumn': {'generation': [0.0] * 24, 'self_consumption': [0.0] * 24, 'surplus_power': [0.0] * 24, 'days': 0},
            'winter': {'generation': [0.0] * 24, 'self_consumption': [0.0] * 24, 'surplus_power': [0.0] * 24, 'days': 0}
        }

def calculate_battery_charge_discharge_pattern(hourly_generation_array: list, hourly_consumption_array: list, 
                                             effective_capacity: float = 0, battery_power: float = 0) -> dict:
    """
    蓄電池の充放電パターンを計算（1時間ごとの詳細シミュレーション）
    
    Args:
        hourly_generation_array: 8760時間分の1時間ごとの発電量配列
        hourly_consumption_array: 8760時間分の1時間ごとの消費電力配列
        effective_capacity: 蓄電池実効容量（kWh）
        battery_power: 蓄電池定格出力（kW）
    
    Returns:
        dict: 蓄電池の充放電パターンデータ
    """
    try:
        if effective_capacity <= 0 or battery_power <= 0:
            # 蓄電池がない場合は空のデータを返す
            return {
                'has_battery': False,
                'daily_charge_pattern': [0.0] * 24,
                'daily_discharge_pattern': [0.0] * 24,
                'daily_battery_level': [0.0] * 24,
                'annual_charge_total': 0.0,
                'annual_discharge_total': 0.0,
                'annual_self_consumption_with_battery': 0.0,
                'annual_sell_electricity_with_battery': 0.0
            }
        
        # 蓄電池データを読み込み
        battery_data = load_json_data('battery_data.json')
        charge_discharge_efficiency = 0.926  # デフォルト値（92.6%）
        display_capacity = 0.0  # 表示用容量
        
        # 蓄電池効率と表示用容量を取得
        if battery_data and 'batteries' in battery_data:
            for battery in battery_data['batteries']:
                if battery.get('effective_capacity_kwh') == effective_capacity:
                    charge_discharge_efficiency = battery.get('charge_discharge_efficiency_percent', 92.6) / 100.0
                    display_capacity = battery.get('capacity_kwh', effective_capacity)
                    break
        
        # 1日分（24時間）のデータを格納する配列
        daily_charge_pattern = [0.0] * 24
        daily_discharge_pattern = [0.0] * 24
        daily_battery_level = [0.0] * 24
        
        # 年間の充放電量を追跡
        annual_charge_total = 0.0
        annual_discharge_total = 0.0
        annual_self_consumption_with_battery = 0.0
        annual_sell_electricity_with_battery = 0.0
        
        # 365日分のデータを24時間ごとに集計
        for day in range(365):
            # その日の蓄電池レベルを追跡（朝の開始時は空）
            soc = 0.0  # State of Charge (蓄電残量)
            
            for hour in range(24):
                # その日のその時間のインデックス
                index = day * 24 + hour
                
                if index < len(hourly_generation_array) and index < len(hourly_consumption_array):
                    generation = hourly_generation_array[index]  # その時間の発電量
                    consumption = hourly_consumption_array[index]  # その時間の消費電力
                    
                    # ステップA: その時間の「充電量」を決定する
                    charge_t = 0.0
                    
                    # 蓄電残量が実効容量より少ない場合のみ充電を検討
                    if soc < effective_capacity:
                        # 余剰電力（発電量 - 消費量）
                        surplus_power = max(0, generation - consumption)
                        
                        # 4つの上限値のうち最も小さい値を充電量とする
                        charge_limits = [
                            battery_power,  # 蓄電池の定格出力（1時間で充電できる最大量）
                            surplus_power * charge_discharge_efficiency,  # その時間の余剰電力 × 充放電効率
                            effective_capacity - soc,  # 蓄電池の空き容量
                            generation  # その時間の総発電量
                        ]
                        
                        charge_t = min(charge_limits)
                    
                    # ステップB: その時間の「放電量」を決定する
                    discharge_t = 0.0
                    
                    # 充電が行われなかった場合のみ放電を検討
                    if charge_t == 0:
                        # 不足電力（消費量 - 発電量）
                        shortage_power = max(0, consumption - generation)
                        
                        # 4つの上限値のうち最も小さい値を放電量とする
                        discharge_limits = [
                            battery_power * charge_discharge_efficiency,  # 蓄電池の定格出力 × 充放電効率
                            soc * charge_discharge_efficiency,  # 現在の蓄電残量 × 充放電効率
                            shortage_power,  # その時間の家庭での消費電力不足分
                            battery_power  # 蓄電池の定格出力
                        ]
                        
                        discharge_t = min(discharge_limits)
                    
                    # ステップC: 次の時間の「蓄電残量」を更新する
                    soc = soc + charge_t - discharge_t
                    
                    # 蓄電残量の範囲を制限（0以上、実効容量以下）
                    soc = max(0.0, min(soc, effective_capacity))
                    
                    # その時間の実際の電力の流れを計算
                    # 蓄電池からの放電がある場合の自家消費量と売電量を再計算
                    actual_generation = generation
                    actual_consumption = consumption
                    
                    if charge_t > 0:
                        # 充電時：余剰電力から充電
                        actual_surplus = max(0, generation - consumption - charge_t)
                        actual_self_consumption = min(generation, consumption)
                        actual_sell = actual_surplus
                    elif discharge_t > 0:
                        # 放電時：蓄電池からの放電で自家消費を補完
                        actual_self_consumption = min(generation + discharge_t, consumption)
                        actual_sell = max(0, generation - max(0, consumption - discharge_t))
                    else:
                        # 充放電なし：通常の計算
                        actual_self_consumption = min(generation, consumption)
                        actual_sell = max(0, generation - consumption)
                    
                    # 年間の累積値を更新
                    annual_charge_total += charge_t
                    annual_discharge_total += discharge_t
                    annual_self_consumption_with_battery += actual_self_consumption
                    annual_sell_electricity_with_battery += actual_sell
                    
                    # 1日分のパターンに累積（365日分の平均を取るため）
                    daily_charge_pattern[hour] += charge_t
                    daily_discharge_pattern[hour] += discharge_t
                    daily_battery_level[hour] += soc
        
        # 365日分の平均を計算
        daily_charge_pattern = [value / 365 for value in daily_charge_pattern]
        daily_discharge_pattern = [value / 365 for value in daily_discharge_pattern]
        daily_battery_level = [value / 365 for value in daily_battery_level]
        
        print(f"デバッグ - 蓄電池充電パターン: {[round(v, 3) for v in daily_charge_pattern]}")
        print(f"デバッグ - 蓄電池放電パターン: {[round(v, 3) for v in daily_discharge_pattern]}")
        print(f"デバッグ - 年間充電量: {annual_charge_total:.1f}kWh")
        print(f"デバッグ - 年間放電量: {annual_discharge_total:.1f}kWh")
        print(f"デバッグ - 蓄電池あり自家消費量: {annual_self_consumption_with_battery:.1f}kWh")
        print(f"デバッグ - 蓄電池あり売電量: {annual_sell_electricity_with_battery:.1f}kWh")
        
        return {
            'has_battery': True,
            'daily_charge_pattern': [round(value, 3) for value in daily_charge_pattern],
            'daily_discharge_pattern': [round(value, 3) for value in daily_discharge_pattern],
            'daily_battery_level': [round(value, 3) for value in daily_battery_level],
            'battery_capacity': display_capacity,  # 表示用容量
            'battery_power': battery_power,
            'charge_discharge_efficiency': charge_discharge_efficiency,
            'annual_charge_total': round(annual_charge_total, 1),
            'annual_discharge_total': round(annual_discharge_total, 1),
            'annual_self_consumption_with_battery': round(annual_self_consumption_with_battery, 1),
            'annual_sell_electricity_with_battery': round(annual_sell_electricity_with_battery, 1)
        }
        
    except Exception as e:
        print(f"蓄電池充放電パターン計算エラー: {e}")
        return {
            'has_battery': False,
            'daily_charge_pattern': [0.0] * 24,
            'daily_discharge_pattern': [0.0] * 24,
            'daily_battery_level': [0.0] * 24,
            'annual_charge_total': 0.0,
            'annual_discharge_total': 0.0,
            'annual_self_consumption_with_battery': 0.0,
            'annual_sell_electricity_with_battery': 0.0
        }

def calculate_monthly_radiation_sum(nedo_data: dict) -> list:
    """月別日射量合計を計算"""
    try:
        # 月別日数（閏年は考慮しない）
        days_in_month = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
        
        # 月別日射量合計を格納する配列
        monthly_radiation = [0.0] * 12
        
        # 365日のデータを月別に集計
        day_count = 0
        for month in range(12):
            for day in range(days_in_month[month]):
                if day_count >= 365:
                    break
                    
                if 'daily_data' not in nedo_data or day_count >= len(nedo_data['daily_data']):
                    print(f"日別データが見つかりません: 日{day_count + 1}")
                    day_count += 1
                    continue
                    
                daily_row = nedo_data['daily_data'][day_count]
                
                # 日合計値を使用（インデックス30）
                if len(daily_row) > 30:
                    try:
                        # 0.01MJ/m²単位の日合計値を取得
                        daily_total = float(daily_row[30])
                        monthly_radiation[month] += daily_total
                    except (ValueError, IndexError):
                        pass
                
                day_count += 1
        
        return monthly_radiation
        
    except Exception as e:
        print(f"月別日射量合計計算エラー: {e}")
        return [0.0] * 12

def calculate_annual_radiation_sum(nedo_data: dict) -> float:
    """365日の日射量合計を計算"""
    try:
        # 365日の日射量を合計
        annual_radiation_001mj = 0.0
        
        # 365日分のデータを処理
        for day_index in range(365):
            if 'daily_data' not in nedo_data or day_index >= len(nedo_data['daily_data']):
                print(f"日別データが見つかりません: 日{day_index + 1}")
                continue
                
            daily_row = nedo_data['daily_data'][day_index]
            
            # 日合計値を使用（インデックス30）
            if len(daily_row) > 30:
                try:
                    # 0.01MJ/m²単位の日合計値を取得
                    daily_total = float(daily_row[30])
                    annual_radiation_001mj += daily_total
                except (ValueError, IndexError):
                    continue
        
        return annual_radiation_001mj
        
    except Exception as e:
        print(f"年間日射量合計計算エラー: {e}")
        return 0.0

def calculate_monthly_generation(module_capacity: float, monthly_radiation: list,
                               inverter_efficiency: float, installation_face: str, 
                               tilt_angle: int) -> list:
    """月別発電量を計算"""
    try:
        # 設置面傾斜係数を取得
        installation_coefficient = get_installation_coefficient(installation_face, tilt_angle)
        
        # システム効率係数
        system_efficiency = 0.95
        
        # 月別発電量を格納する配列
        monthly_generation = []
        
        for month in range(12):
            # 月別温度損失係数を取得
            temperature_coefficient = get_temperature_coefficient(month + 1)
            
            # 月別発電量計算
            # 計算式: モジュール容量(kW) * 月別日射量合計値(0.01MJ/m²) * 0.01/3.6 * パワーコンディショナ効率 * 温度損失係数 * システム効率係数 * 設置面傾斜係数
            monthly_gen = (module_capacity * monthly_radiation[month] * 0.01 / 3.6 * 
                          inverter_efficiency * temperature_coefficient * 
                          system_efficiency * installation_coefficient)
            
            monthly_generation.append(round(monthly_gen, 0))
        
        return monthly_generation
        
    except Exception as e:
        print(f"月別発電量計算エラー: {e}")
        return [0] * 12

def calculate_annual_generation(module_capacity: float, annual_radiation_sum: float,
                              inverter_efficiency: float, installation_face: str, 
                              tilt_angle: int) -> float:
    """年間発電量を計算"""
    try:
        # 設置面傾斜係数を取得
        installation_coefficient = get_installation_coefficient(installation_face, tilt_angle)
        
        # 年間平均温度損失係数（簡易計算）
        # 冬季3ヶ月×0.98 + 春秋6ヶ月×0.93 + 夏季3ヶ月×0.88
        temperature_coefficient = (3 * 0.98 + 6 * 0.93 + 3 * 0.88) / 12
        
        # システム効率係数
        system_efficiency = 0.95
        
        # 年間発電量計算
        # 計算式: モジュール容量(kW) * 日射量合計値(0.01MJ/m²) * 0.01/3.6 * パワーコンディショナ効率 * 温度損失係数 * システム効率係数 * 設置面傾斜係数
        annual_generation = (module_capacity * annual_radiation_sum * 0.01 / 3.6 * 
                           inverter_efficiency * temperature_coefficient * 
                           system_efficiency * installation_coefficient)
        
        return annual_generation
        
    except Exception as e:
        print(f"年間発電量計算エラー: {e}")
        return 0.0

def calculate_solar_generation_with_nedo(form_data: Dict[str, Any]) -> float:
    """NEDOデータを使用した年間発電量の計算（1時間単位ロジック）"""
    try:
        # 新しい1時間単位の計算ロジックを使用
        monthly_generation, annual_generation = calculate_hourly_generation_with_nedo(form_data)
        
        return round(annual_generation, 0)
        
    except Exception as e:
        print(f"NEDOデータを使用した発電量計算エラー: {e}")
        return 0

def calculate_economic_effects(form_data: Dict[str, Any], annual_generation: float, 
                             annual_self_consumption: float, annual_sell_electricity: float) -> Dict[str, Any]:
    """経済効果を計算する（10年間の売電単価変動対応版）"""
    try:
        # 電力会社とプラン情報を取得
        utility_company = form_data.get('utilityCompany', '')
        contract_plan = form_data.get('contractPlan', '')
        
        # 電力会社のプランデータを読み込み
        utility_files = {
            '東京電力': 'tepco_plans.json',
            '中部電力': 'chuden_plans.json',
            '関西電力': 'kepco_plans.json',
            '中国電力': 'chugoku_plans.json',
            '四国電力': 'shikoku_plans.json',
            '九州電力': 'kyushu_plans.json'
        }
        
        plan_data = {}
        if utility_company in utility_files:
            plan_data = load_json_data(utility_files[utility_company])
        
        # 契約プランの料金情報を取得
        plan_info = None
        if plan_data and 'active_plans' in plan_data:
            for plan in plan_data['active_plans'].get('plans', []):
                if plan.get('plan_name') == contract_plan:
                    plan_info = plan
                    break
        
        # 買電単価（円/kWh）- プラン情報から取得、デフォルト値も設定
        buy_price_per_kwh = 30.0  # デフォルト値
        if plan_info:
            # プラン情報から料金を取得（簡易計算）
            if 'usage_rate_tier2' in plan_info:
                buy_price_per_kwh = float(plan_info['usage_rate_tier2'])
            elif 'usage_rate' in plan_info:
                buy_price_per_kwh = float(plan_info['usage_rate'])
        
        # 10年間の売電単価設定（FIT制度の期間と単価の変動を考慮）
        sell_prices = {
            1: 24.0,  # 1年目～4年目: 24円/kWh（FIT制度適用期間）
            2: 24.0,
            3: 24.0,
            4: 24.0,
            5: 8.3,   # 5年目～10年目: 8.3円/kWh（FIT制度終了後）
            6: 8.3,
            7: 8.3,
            8: 8.3,
            9: 8.3,
            10: 8.3
        }
        
        # 10年間の詳細データを計算（年次ごとの売電額を個別に算出）
        yearly_breakdown = []
        total_10year_effect = 0
        total_10year_sell_revenue = 0
        total_10year_self_consumption_savings = 0
        
        for year in range(1, 11):
            sell_price = sell_prices[year]
            
            # その年の売電収入（年間売電額を個別に算出）
            annual_sell_revenue = annual_sell_electricity * sell_price
            
            # その年の自家消費による節約額（買電単価は変化しないと仮定）
            annual_self_consumption_savings = annual_self_consumption * buy_price_per_kwh
            
            # その年の合計経済効果
            annual_total_effect = annual_self_consumption_savings + annual_sell_revenue
            
            # 累計値を更新
            total_10year_effect += annual_total_effect
            total_10year_sell_revenue += annual_sell_revenue
            total_10year_self_consumption_savings += annual_self_consumption_savings
            
            # 年次ごとの詳細データを格納
            yearly_breakdown.append({
                'year': year,
                'sell_price': sell_price,
                'sell_revenue': round(annual_sell_revenue, 0),
                'self_consumption_kwh': round(annual_self_consumption, 0),  # 年間自家消費量 (kWh)
                'self_consumption_yen': round(annual_self_consumption_savings, 0),  # 年間自家消費額 (円)
                'self_consumption_savings': round(annual_self_consumption_savings, 0),
                'total_effect': round(annual_total_effect, 0),
                'cumulative_total_effect': round(total_10year_effect, 0)
            })
        
        # 1年目のデータを基準として返却（後方互換性のため）
        first_year = yearly_breakdown[0]
        
        return {
            'annual_self_consumption': round(annual_self_consumption, 0),
            'annual_sell_electricity': round(annual_sell_electricity, 0),
            'annual_self_consumption_savings': first_year['self_consumption_savings'],
            'annual_sell_revenue': first_year['sell_revenue'],
            'total_economic_effect': first_year['total_effect'],
            'buy_price_per_kwh': buy_price_per_kwh,
            'sell_price_per_kwh': first_year['sell_price'],
            'yearly_breakdown': yearly_breakdown,
            'total_10year_effect': round(total_10year_effect, 0),
            'total_10year_sell_revenue': round(total_10year_sell_revenue, 0),
            'total_10year_self_consumption_savings': round(total_10year_self_consumption_savings, 0),
            'fit_period_years': 4,  # FIT制度適用期間（年）
            'fit_sell_price': 24.0,  # FIT制度適用期間の売電単価
            'post_fit_sell_price': 8.3  # FIT制度終了後の売電単価
        }
        
    except Exception as e:
        print(f"経済効果計算エラー: {e}")
        return {
            'annual_self_consumption': 0,
            'annual_sell_electricity': 0,
            'annual_self_consumption_savings': 0,
            'annual_sell_revenue': 0,
            'total_economic_effect': 0,
            'buy_price_per_kwh': 30.0,
            'sell_price_per_kwh': 24.0,
            'yearly_breakdown': [],
            'total_10year_effect': 0,
            'total_10year_sell_revenue': 0,
            'total_10year_self_consumption_savings': 0,
            'fit_period_years': 4,
            'fit_sell_price': 24.0,
            'post_fit_sell_price': 8.3
        }

def calculate_simulation(form_data: Dict[str, Any]) -> Dict[str, Any]:
    """メインのシミュレーション計算関数（時間単位自家消費量計算対応版）"""
    try:
        # ステップA: 1時間単位の発電量計算（8760時間分の配列も取得）
        monthly_generation, annual_generation, hourly_generation_array, hourly_average_generation = calculate_hourly_generation_with_nedo(form_data)
        
        # ステップB: 時間単位の自家消費量計算
        annual_self_consumption, annual_sell_electricity, hourly_consumption_array = calculate_self_consumption(form_data, hourly_generation_array)
        
        # ステップC: 1日の時間別データを計算
        hourly_self_consumption, hourly_surplus_power = calculate_daily_hourly_data(hourly_generation_array, hourly_consumption_array)
        

        
        # ステップC-3: 蓄電池の充放電パターンを計算
        battery_capacity = 0.0
        battery_power = 0.0
        
        # 蓄電池情報を取得
        battery_model = form_data.get('batteryModel', '')
        if battery_model and battery_model != 'なし':
            # 蓄電池データを読み込み
            battery_data = load_json_data('battery_data.json')
            if battery_data and 'batteries' in battery_data:
                for battery in battery_data['batteries']:
                    if battery.get('model_name') == battery_model:
                        # 容量はcapacity_kwhを使用、実効容量は計算用に使用
                        battery_capacity = float(battery.get('capacity_kwh', 0))  # 表示用
                        effective_capacity = float(battery.get('effective_capacity_kwh', battery.get('capacity_kwh', 0)))  # 計算用
                        battery_power = float(battery.get('rated_output_kw', 0))
                        break
        
        battery_pattern = calculate_battery_charge_discharge_pattern(
            hourly_generation_array, hourly_consumption_array, effective_capacity, battery_power
        )
        
        # ステップD: 経済効果の計算
        # 蓄電池ありの場合は蓄電池ありの自家消費量・売電量を使用、なしの場合は通常の値をを使用
        if battery_pattern['has_battery']:
            economic_effects = calculate_economic_effects(
                form_data, annual_generation, 
                battery_pattern['annual_self_consumption_with_battery'], 
                battery_pattern['annual_sell_electricity_with_battery']
            )
        else:
            economic_effects = calculate_economic_effects(form_data, annual_generation, annual_self_consumption, annual_sell_electricity)
        
        # ステップE: 結果の返却
        result = {
            'estimated_generation': annual_generation,
            'monthly_generation': monthly_generation,
            'hourly_average_generation': [round(value, 3) for value in hourly_average_generation],
            'annual_self_consumption': economic_effects['annual_self_consumption'],
            'annual_sell_electricity': economic_effects['annual_sell_electricity'],
            'annual_self_consumption_savings': economic_effects['annual_self_consumption_savings'],
            'annual_sell_revenue': economic_effects['annual_sell_revenue'],
            'total_economic_effect': economic_effects['total_economic_effect'],
            'buy_price_per_kwh': economic_effects['buy_price_per_kwh'],
            'sell_price_per_kwh': economic_effects['sell_price_per_kwh'],
            'hourly_generation': [round(value, 3) for value in hourly_average_generation],
            'hourly_self_consumption': [round(value, 3) for value in hourly_self_consumption],
            'hourly_surplus_power': [round(value, 3) for value in hourly_surplus_power],
            'battery_pattern': battery_pattern,
            
            # 蓄電池ありなしの比較データ
            'battery_comparison': {
                'without_battery': {
                    'annual_self_consumption': annual_self_consumption,
                    'annual_sell_electricity': annual_sell_electricity
                },
                'with_battery': {
                    'annual_self_consumption': battery_pattern['annual_self_consumption_with_battery'],
                    'annual_sell_electricity': battery_pattern['annual_sell_electricity_with_battery'],
                    'annual_charge_total': battery_pattern['annual_charge_total'],
                    'annual_discharge_total': battery_pattern['annual_discharge_total']
                }
            },
            
            # 10年間の詳細な経済効果データ（FIT制度対応）
            'yearly_breakdown': economic_effects['yearly_breakdown'],
            'total_10year_effect': economic_effects['total_10year_effect'],
            'total_10year_sell_revenue': economic_effects['total_10year_sell_revenue'],
            'total_10year_self_consumption_savings': economic_effects['total_10year_self_consumption_savings'],
            'fit_period_years': economic_effects['fit_period_years'],
            'fit_sell_price': economic_effects['fit_sell_price'],
            'post_fit_sell_price': economic_effects['post_fit_sell_price']
        }
        
        return result
        
    except Exception as e:
        print(f"シミュレーション計算エラー: {e}")
        return {
            'estimated_generation': 0,
            'monthly_generation': [0] * 12,
            'hourly_average_generation': [0] * 24,
            'annual_self_consumption': 0,
            'annual_sell_electricity': 0,
            'annual_self_consumption_savings': 0,
            'annual_sell_revenue': 0,
            'total_economic_effect': 0,
            'buy_price_per_kwh': 30.0,
            'sell_price_per_kwh': 10.0,
            'battery_pattern': {
                'has_battery': False,
                'daily_charge_pattern': [0.0] * 24,
                'daily_discharge_pattern': [0.0] * 24,
                'daily_battery_level': [0.0] * 24,
                'annual_charge_total': 0.0,
                'annual_discharge_total': 0.0,
                'annual_self_consumption_with_battery': 0.0,
                'annual_sell_electricity_with_battery': 0.0
            },
            'battery_comparison': {
                'without_battery': {
                    'annual_self_consumption': 0,
                    'annual_sell_electricity': 0
                },
                'with_battery': {
                    'annual_self_consumption': 0,
                    'annual_sell_electricity': 0,
                    'annual_charge_total': 0,
                    'annual_discharge_total': 0
                }
            },
            'error': str(e)
        } 