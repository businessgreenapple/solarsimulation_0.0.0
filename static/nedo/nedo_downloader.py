#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
NEDOデータベース自動ダウンロードプログラム
太陽光発電シミュレーション用の地点データを自動取得します
"""

import requests
import pandas as pd
import time 
import os
import json
import ssl
from datetime import datetime
from urllib.parse import urljoin, urlparse
import logging
from typing import Dict, List, Optional, Any, Union
import re

# ログ設定
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(message)s',
    handlers=[
        logging.FileHandler('nedo_download.log', encoding='utf-8'),
        logging.StreamHandler()
    ]
)
logger = logging.getLogger(__name__)

class NEDODownloader:
    """NEDOデータベースダウンローダー"""
    
    def __init__(self, base_url: str = "https://appww2.infoc.nedo.go.jp/appww/"):
        self.base_url = base_url
        self.session = requests.Session()
        
        # SSL/TLS設定の改善
        context = ssl.create_default_context()
        # より柔軟な暗号化スイートを設定
        try:
            context.set_ciphers('DEFAULT@SECLEVEL=1')
        except ssl.SSLError:
            # セキュリティレベル設定が失敗した場合の代替設定
            context.set_ciphers('DEFAULT')
        
        # Python 3.13対応: TLSv1_2以上を使用
        context.minimum_version = ssl.TLSVersion.TLSv1_2
        context.maximum_version = ssl.TLSVersion.TLSv1_3
        
        # カスタムアダプターを作成（SSLコンテキスト付き）
        from requests.adapters import HTTPAdapter
        from urllib3.util.ssl_ import create_urllib3_context
        
        class CustomHTTPAdapter(HTTPAdapter):
            def init_poolmanager(self, *args, **kwargs):
                kwargs['ssl_context'] = context
                return super().init_poolmanager(*args, **kwargs)
            
            def proxy_manager_for(self, *args, **kwargs):
                kwargs['ssl_context'] = context
                return super().proxy_manager_for(*args, **kwargs)
        
        adapter = CustomHTTPAdapter(max_retries=3)
        self.session.mount('https://', adapter)
        
        # セッションのSSL設定
        self.session.verify = True
        self.session.headers.update({
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
            'Accept-Language': 'ja,en-US;q=0.7,en;q=0.3',
            'Accept-Encoding': 'gzip, deflate',
            'Connection': 'keep-alive',
            'Upgrade-Insecure-Requests': '1'
        })
        
        # ダウンロード間隔（秒）
        self.download_interval = 3.0
        
        # ダウンロードディレクトリ
        self.download_dir = r"C:\Users\kawasaki46535\web_solarsimulation\nedo_solar_data"
        os.makedirs(self.download_dir, exist_ok=True)
        
        # 既存の地点データを読み込み
        self.locations_df = self._load_locations()
        
    def _load_locations(self) -> pd.DataFrame:
        """地点マスターデータを読み込み"""
        try:
            locations_file = "nedo_locations_master.csv"
            if os.path.exists(locations_file):
                df = pd.read_csv(locations_file)
                logger.info(f"地点データを読み込みました: {len(df)}件")
                return df
            else:
                logger.warning(f"地点データファイルが見つかりません: {locations_file}")
                return pd.DataFrame()
        except Exception as e:
            logger.error(f"地点データ読み込みエラー: {e}")
            return pd.DataFrame()
    
    def get_location_url(self, location_id: str) -> str:
        """地点IDからNEDO URLを生成"""
        return f"{self.base_url}metpv.html?p={location_id}"
    
    def download_location_data(self, location_id: str, location_name: str, max_retries: int = 3) -> bool:
        """指定地点のデータをダウンロード（リトライ機能付き）"""
        for attempt in range(max_retries):
            try:
                # 正しいNEDOダウンロードURLとパラメータを使用
                download_url = f"{self.base_url}cgi-bin/download.cgi"
                download_params = {
                    'f': '0',      # ファイル形式（0=CSV）
                    'kk': '5',     # データ種別（5=気象データ）
                    'p': location_id,  # 地点ID
                    'y': '0',      # 年（0=標準年）
                    'mode': '0'    # モード（0=通常）
                }
                
                logger.info(f"ダウンロード開始: {location_name} ({location_id}) (試行 {attempt + 1}/{max_retries})")
                logger.info(f"ダウンロードURL: {download_url}")
                logger.info(f"パラメータ: {download_params}")
                
                # CSVデータをダウンロード（SSL/TLS設定付き）
                csv_response = self.session.get(download_url, params=download_params, timeout=60, verify=True)
                csv_response.raise_for_status()
                
                # レスポンス内容を確認
                content_length = len(csv_response.content)
                logger.info(f"ダウンロードされたデータサイズ: {content_length} bytes")
                
                # レスポンスヘッダーを確認
                content_type = csv_response.headers.get('content-type', '')
                logger.info(f"Content-Type: {content_type}")
                
                # ファイル保存
                filename = f"hm{location_id}year.csv"
                filepath = os.path.join(self.download_dir, filename)
                
                with open(filepath, 'wb') as f:
                    f.write(csv_response.content)
                
                logger.info(f"ダウンロード完了: {filename}")
                
                # データ検証
                self._validate_downloaded_data(filepath, location_id)
                
                return True
                
            except requests.exceptions.SSLError as e:
                logger.error(f"SSLエラー ({location_name}) 試行 {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 5  # 5秒、10秒、15秒と待機時間を増加
                    logger.info(f"{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"SSLエラーでダウンロード失敗: {location_name}")
                    return False
                    
            except requests.exceptions.ConnectionError as e:
                logger.error(f"接続エラー ({location_name}) 試行 {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    logger.info(f"{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"接続エラーでダウンロード失敗: {location_name}")
                    return False
                    
            except requests.exceptions.Timeout as e:
                logger.error(f"タイムアウト ({location_name}) 試行 {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    logger.info(f"{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"タイムアウトでダウンロード失敗: {location_name}")
                    return False
                    
            except requests.exceptions.RequestException as e:
                logger.error(f"リクエストエラー ({location_name}) 試行 {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 3
                    logger.info(f"{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"リクエストエラーでダウンロード失敗: {location_name}")
                    return False
                    
            except Exception as e:
                logger.error(f"予期しないエラー ({location_name}) 試行 {attempt + 1}/{max_retries}: {e}")
                if attempt < max_retries - 1:
                    wait_time = (attempt + 1) * 2
                    logger.info(f"{wait_time}秒後にリトライします...")
                    time.sleep(wait_time)
                else:
                    logger.error(f"予期しないエラーでダウンロード失敗: {location_name}")
                    return False
        
        return False
    
    def _validate_downloaded_data(self, filepath: str, location_id: str):
        """ダウンロードしたデータを検証"""
        try:
            # ファイルサイズチェック
            file_size = os.path.getsize(filepath)
            logger.info(f"ファイルサイズ: {filepath} ({file_size} bytes)")
            
            if file_size < 1000:  # 1KB未満は異常
                logger.warning(f"ファイルサイズが小さすぎます: {filepath} ({file_size} bytes)")
                return False
            
            # CSV形式チェック
            with open(filepath, 'r', encoding='utf-8') as f:
                first_line = f.readline().strip()
                logger.info(f"ファイルの最初の行: {first_line[:100]}...")
                
                if not first_line:
                    logger.warning(f"ファイルが空です: {filepath}")
                    return False
                
                if ',' not in first_line and '\t' not in first_line:
                    logger.warning(f"CSV/TSV形式ではありません: {filepath}")
                    return False
            
            logger.info(f"データ検証完了: {filepath}")
            return True
            
        except Exception as e:
            logger.error(f"データ検証エラー: {e}")
            return False
    
    def download_all_locations(self, max_locations: Optional[int] = None) -> Dict[str, bool]:
        """全地点のデータをダウンロード"""
        if self.locations_df.empty:
            logger.error("地点データが読み込まれていません")
            return {}
        
        results = {}
        total_locations = len(self.locations_df)
        
        if max_locations:
            self.locations_df = self.locations_df.head(max_locations)
            logger.info(f"最大{max_locations}地点までダウンロードします")
        
        logger.info(f"ダウンロード開始: {len(self.locations_df)}地点")
        
        for index, row in self.locations_df.iterrows():
            location_id = str(row['地点ID'])
            location_name = f"{row['都道府県']} - {row['地点名']}"
            
            # 既存ファイルチェック
            filename = f"hm{location_id}year.csv"
            filepath = os.path.join(self.download_dir, filename)
            
            if os.path.exists(filepath):
                logger.info(f"既存ファイルをスキップ: {location_name}")
                results[location_id] = True
                continue
            
            # ダウンロード実行
            success = self.download_location_data(location_id, location_name)
            results[location_id] = success

            # 進捗表示
            progress = (list(self.locations_df.index).index(index) + 1) / len(self.locations_df) * 100
            logger.info(f"進捗: {list(self.locations_df.index).index(index) + 1}/{len(self.locations_df)} ({progress:.1f}%)")

            # サーバー負荷軽減のため間隔を設ける
            if list(self.locations_df.index).index(index) < len(self.locations_df) - 1:  # 最後の地点以外
                logger.info(f"次のダウンロードまで{self.download_interval}秒待機...")
                time.sleep(self.download_interval)
        
        # 結果サマリー
        success_count = sum(results.values())
        total_count = len(results)
        logger.info(f"ダウンロード完了: {success_count}/{total_count} 成功")
        
        return results
    
    def download_specific_locations(self, location_ids: List[str]) -> Dict[str, bool]:  # type: ignore
        """指定地点のデータをダウンロード"""
        results = {}
        
        for location_id in location_ids:
            # 地点情報を取得
            location_info = self.locations_df[self.locations_df['地点ID'] == int(location_id)]
            
            if location_info.empty:
                logger.warning(f"地点ID {location_id} が見つかりません")
                results[location_id] = False
                continue
            
            location_name = f"{location_info.iloc[0]['都道府県']} - {location_info.iloc[0]['地点名']}"
            
            # ダウンロード実行
            success = self.download_location_data(location_id, location_name)
            results[location_id] = success
            
            # 間隔を設ける
            time.sleep(self.download_interval)
        
        return results

    def get_download_status(self) -> Dict[str, Any]:
        """ダウンロード状況を確認"""
        if self.locations_df.empty:
            return {"error": "地点データが読み込まれていません"}
        status = {
            "total_locations": len(self.locations_df),
            "downloaded": 0,
            "missing": 0,
            "downloaded_files": [],
            "missing_locations": []
        }
        
        for _, row in self.locations_df.iterrows():
            location_id = str(row['地点ID'])
            filename = f"hm{location_id}year.csv"
            filepath = os.path.join(self.download_dir, filename)
            
            if os.path.exists(filepath):
                status["downloaded"] += 1
                status["downloaded_files"].append({
                    "location_id": location_id,
                    "location_name": f"{row['都道府県']} - {row['地点名']}",
                    "filename": filename,
                    "file_size": os.path.getsize(filepath)
                })
            else:
                status["missing"] += 1
                status["missing_locations"].append({
                    "location_id": location_id,
                    "location_name": f"{row['都道府県']} - {row['地点名']}"
                })
        
        return status
    
    def test_connection(self) -> bool:
        """接続テストを実行"""
        try:
            logger.info("NEDOサーバーへの接続テストを開始...")
            
            # テスト用の地点ID（東京）
            test_location_id = "40046"
            test_url = f"{self.base_url}cgi-bin/download.cgi"
            test_params = {
                'f': '0',
                'kk': '5',
                'p': test_location_id,
                'y': '0',
                'mode': '0'
            }
            
            logger.info(f"テストURL: {test_url}")
            logger.info(f"テストパラメータ: {test_params}")
            
            # 接続テスト
            response = self.session.get(test_url, params=test_params, timeout=30, verify=True)
            response.raise_for_status()
            
            logger.info("接続テスト成功: NEDOサーバーに正常に接続できました")
            return True
            
        except requests.exceptions.SSLError as e:
            logger.error(f"SSL接続テスト失敗: {e}")
            return False
        except requests.exceptions.RequestException as e:
            logger.error(f"接続テスト失敗: {e}")
            return False
        except Exception as e:
            logger.error(f"予期しないエラー: {e}")
            return False

def main():
    """メイン実行関数"""
    print("NEDOデータベース自動ダウンロードプログラム")
    print("=" * 50)
    
    # ダウンローダー初期化
    downloader = NEDODownloader()
    
    # 現在の状況を確認
    status = downloader.get_download_status()
    print(f"総地点数: {status['total_locations']}")
    print(f"ダウンロード済み: {status['downloaded']}")
    print(f"未ダウンロード: {status['missing']}")
    
    if status['missing'] == 0:
        print("すべての地点のデータがダウンロード済みです")
        return
    
    # 実行オプション
    print("\n実行オプション:")
    print("1. 全地点ダウンロード")
    print("2. 未ダウンロード地点のみダウンロード")
    print("3. 特定地点ダウンロード")
    print("4. 状況確認のみ")
    print("5. 接続テスト")
    
    choice = input("\n選択してください (1-5): ").strip()
    
    if choice == "1":
        max_locations = input("最大ダウンロード地点数 (Enterで全地点): ").strip()
        max_locations = int(max_locations) if max_locations.isdigit() else None
        results = downloader.download_all_locations(max_locations)
        
    elif choice == "2":
        # 未ダウンロード地点のみ
        missing_ids = [loc['location_id'] for loc in status['missing_locations']]
        results = downloader.download_specific_locations(missing_ids)
        
    elif choice == "3":
        location_ids = input("ダウンロードする地点IDをカンマ区切りで入力: ").strip()
        location_ids = [id.strip() for id in location_ids.split(',') if id.strip()]
        results = downloader.download_specific_locations(location_ids)
        
    elif choice == "4":
        print("\n詳細状況:")
        for file_info in status['downloaded_files']:
            print(f"✓ {file_info['location_name']} ({file_info['filename']})")
        for missing_info in status['missing_locations']:
            print(f"✗ {missing_info['location_name']} (未ダウンロード)")
        return
        
    elif choice == "5":
        print("\n接続テストを実行します...")
        if downloader.test_connection():
            print("✓ 接続テスト成功: ダウンロード可能です")
        else:
            print("✗ 接続テスト失敗: SSL/TLS設定を確認してください")
        return
        
    else:
        print("無効な選択です")
        return
    
    # 結果表示
    success_count = sum(results.values())
    total_count = len(results)
    print(f"\nダウンロード結果: {success_count}/{total_count} 成功")

if __name__ == "__main__":
    main() 