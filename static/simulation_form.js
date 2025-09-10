// 都道府県リストはnedo_locations_master.jsonファイルから動的に読み込み
let prefectures = [];

// 地点データはnedo_locations_master.jsonファイルから動的に読み込み

// 電力会社サンプル
const utilityCompanies = ['東京電力', '中部電力', '関西電力', '中国電力', '四国電力', '九州電力'];

// 契約プラン（電力会社ごとにJSONファイルから読み込み）
let contractPlans = [];

// 電力会社とJSONファイルの対応
const utilityCompanyFiles = {
    '東京電力': 'tepco_plans.json',
    '中部電力': 'chuden_plans.json',
    '関西電力': 'kepco_plans.json',
    '中国電力': 'chugoku_plans.json',
    '四国電力': 'shikoku_plans.json',
    '九州電力': 'kyushu_plans.json'
};

// モジュールデータ（JSONファイルから動的に読み込み）
let moduleData = [];
let selectedModuleData = null;

// 電気使用形態データ（JSONファイルから動的に読み込み）
let usagePatternData = {};

// 屋根の傾斜角度データ（JSONファイルから動的に読み込み）
let roofAngleData = [];

// モジュール枚数サンプル
const moduleQuantities = Array.from({length: 30}, (_, i) => i + 1);

// インバータデータ（JSONファイルから動的に読み込み）
let inverterData = [];

// インバータ台数サンプル
const inverterQuantities = Array.from({length: 5}, (_, i) => i + 1);

// 蓄電池データ（JSONファイルから動的に読み込み）
let batteryData = [];

// 現在のステップ
let currentStep = 1;
const totalSteps = 6;

// 月別発電量グラフのインスタンス管理
window.monthlyGenerationChart = null;
// 1日の電力の流れ複合グラフのインスタンス管理
window.powerFlowChart = null;

// フォームデータの保存
let formData = {};

// 自動計算実行フラグ
let autoCalculationExecuted = false;

// 月別データの月名マッピング
const monthNames = {
    'usage_jan': '1月', 'bill_jan': '1月',
    'usage_feb': '2月', 'bill_feb': '2月',
    'usage_mar': '3月', 'bill_mar': '3月',
    'usage_apr': '4月', 'bill_apr': '4月',
    'usage_may': '5月', 'bill_may': '5月',
    'usage_jun': '6月', 'bill_jun': '6月',
    'usage_jul': '7月', 'bill_jul': '7月',
    'usage_aug': '8月', 'bill_aug': '8月',
    'usage_sep': '9月', 'bill_sep': '9月',
    'usage_oct': '10月', 'bill_oct': '10月',
    'usage_nov': '11月', 'bill_nov': '11月',
    'usage_dec': '12月', 'bill_dec': '12月'
};

// 月別割合データ（季節変動）
const monthlyRatios = {
    'jan': 0.093, // 1月: 9.3%
    'feb': 0.102, // 2月: 10.2%
    'mar': 0.099, // 3月: 9.9%
    'apr': 0.093, // 4月: 9.3%
    'may': 0.077, // 5月: 7.7%
    'jun': 0.067, // 6月: 6.7%
    'jul': 0.068, // 7月: 6.8%
    'aug': 0.085, // 8月: 8.5%
    'sep': 0.085, // 9月: 8.5%
    'oct': 0.073, // 10月: 7.3%
    'nov': 0.072, // 11月: 7.2%
    'dec': 0.086  // 12月: 8.6%
};

// 現在のページ番号を取得する関数
function getCurrentPageNumber() {
    const path = window.location.pathname;
    const match = path.match(/simulation_form_(\d+)/);
    return match ? parseInt(match[1]) : 1;
}

// ドロップダウン初期化
function populateSelect(id, options, placeholder) {
    const select = document.getElementById(id);
    if (!select) {
        console.warn(`要素が見つかりません: ${id}`);
        return; // 要素が存在しない場合は何もしない
    }
    
    console.log(`${id}のドロップダウンを更新します:`, options);
    
    select.innerHTML = '';
    if (placeholder) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = placeholder;
        opt.disabled = true;
        opt.selected = true;
        select.appendChild(opt);
    }
    options.forEach(optVal => {
        const opt = document.createElement('option');
        opt.value = optVal;
        opt.textContent = optVal;
        select.appendChild(opt);
    });
    
    console.log(`${id}のドロップダウン更新完了`);
}

// ステップ移動関数
function showStep(stepNumber) {
    // 現在のステップを非表示
    document.querySelectorAll('.step-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // 指定されたステップを表示
    const targetStep = document.querySelector(`[data-step="${stepNumber}"]`);
    if (targetStep) {
        targetStep.classList.add('active');
    }
    
    // 進捗インジケーターを更新
    updateProgressIndicator(stepNumber);
}

// 進捗インジケーターの更新
function updateProgressIndicator(activeStep) {
    document.querySelectorAll('.step').forEach((step, index) => {
        const stepNumber = index + 1;
        step.classList.remove('active', 'completed');
        
        if (stepNumber === activeStep) {
            step.classList.add('active');
        } else if (stepNumber < activeStep) {
            step.classList.add('completed');
        }
    });
}

// 次のステップへ（ページ遷移）
function nextStep() {
    const currentPage = getCurrentPageNumber();
    
    if (validateCurrentStep()) {
        // 現在のステップのデータをローカルストレージに保存
        saveCurrentStepData();
        
        if (currentPage < totalSteps) {
            const nextPage = currentPage + 1;
            window.location.href = `/simulation_form_${nextPage}`;
        }
    }
}

// 現在のステップのデータをローカルストレージに保存
function saveCurrentStepData() {
    const currentPage = getCurrentPageNumber();
    
    // 現在のページのフォームデータを収集
    const currentFormData = {};
    
    if (currentPage === 1) {
        // ステップ1のデータを収集
        const prefectureSelect = document.getElementById('prefecture');
        const locationSelect = document.getElementById('location-select');
        
        if (prefectureSelect && prefectureSelect.value) {
            currentFormData.prefecture = prefectureSelect.value;
        }
        if (locationSelect && locationSelect.value) {
            currentFormData.location = locationSelect.value;
            console.log('デバッグ - 収集した地点データ:', locationSelect.value);
        }
    } else if (currentPage === 2) {
        // ステップ2のデータを収集
        const utilitySelect = document.getElementById('utility-company');
        const contractSelect = document.getElementById('contract-plan');
        const usagePatternSelect = document.getElementById('usage-pattern');
        
        if (utilitySelect && utilitySelect.value) {
            currentFormData.utilityCompany = utilitySelect.value;
        }
        if (contractSelect && contractSelect.value) {
            currentFormData.contractPlan = contractSelect.value;
        }
        if (usagePatternSelect && usagePatternSelect.value) {
            currentFormData.usagePattern = usagePatternSelect.value;
        }
        
        // 月別データを収集
        const monthlyInputs = document.querySelectorAll('input[name^="usage_"], input[name^="bill_"]');
        monthlyInputs.forEach(input => {
            if (input.value.trim()) {
                currentFormData[input.name] = input.value.trim();
            }
        });
    } else if (currentPage === 3) {
        // ステップ3のデータを収集
        const moduleModelSelect = document.getElementById('module-model');
        const moduleQuantityInput = document.getElementById('module-quantity');
        const installationFaceSelect = document.getElementById('installation-face');
        const roofAngleSelect = document.getElementById('roof-angle');
        
        if (moduleModelSelect && moduleModelSelect.value) {
            currentFormData.moduleModel = moduleModelSelect.value;
        }
        if (moduleQuantityInput && moduleQuantityInput.value) {
            currentFormData.moduleQuantity = moduleQuantityInput.value;
        }
        if (installationFaceSelect && installationFaceSelect.value) {
            currentFormData.installationFace = installationFaceSelect.value;
        }
        if (roofAngleSelect && roofAngleSelect.value) {
            currentFormData.roofAngle = roofAngleSelect.value;
        }
    } else if (currentPage === 4) {
        // ステップ4のデータを収集
        // パワーコンディショナ1の情報
        const inverterModelSelect = document.getElementById('inverter-model');
        const inverterQuantitySelect = document.getElementById('inverter-quantity');
        const seriesInput = document.getElementById('series-input');
        const parallelInput = document.getElementById('parallel-input');
        
        if (inverterModelSelect && inverterModelSelect.value) {
            currentFormData.inverterModel = inverterModelSelect.value;
        }
        if (inverterQuantitySelect && inverterQuantitySelect.value) {
            currentFormData.inverterQuantity = inverterQuantitySelect.value;
        }
        
        // ストリング構成
        if (seriesInput && parallelInput && seriesInput.value && parallelInput.value) {
            currentFormData.stringConfiguration = {
                series: parseInt(seriesInput.value),
                parallel: parseInt(parallelInput.value)
            };
        }
        
        // パワーコンディショナ2の情報（存在する場合）
        const inverterGroup2 = document.getElementById('inverter-group-2');
        if (inverterGroup2 && inverterGroup2.style.display !== 'none') {
            const inverterModel2Select = document.getElementById('inverter-model2');
            const inverterQuantity2Select = document.getElementById('inverter-quantity2');
            const series2Input = document.getElementById('series-input2');
            const parallel2Input = document.getElementById('parallel-input2');
            
            if (inverterModel2Select && inverterModel2Select.value) {
                currentFormData.inverterModel2 = inverterModel2Select.value;
            }
            if (inverterQuantity2Select && inverterQuantity2Select.value) {
                currentFormData.inverterQuantity2 = inverterQuantity2Select.value;
            }
            
            // ストリング構成2
            if (series2Input && parallel2Input && series2Input.value && parallel2Input.value) {
                currentFormData.stringConfiguration2 = {
                    series: parseInt(series2Input.value),
                    parallel: parseInt(parallel2Input.value)
                };
            }
        }
    } else if (currentPage === 5) {
        // ステップ5のデータを収集
        const batteryModelSelect = document.getElementById('battery-model');
        
        if (batteryModelSelect && batteryModelSelect.value) {
            currentFormData.batteryModel = batteryModelSelect.value;
        }
    }
    
    // 既存のformDataとマージ
    const existingData = JSON.parse(localStorage.getItem('simulationFormData') || '{}');
    const updatedData = Object.assign({}, existingData, currentFormData);
    
    // ローカルストレージに保存
    localStorage.setItem('simulationFormData', JSON.stringify(updatedData));
    
    console.log('ステップ', currentPage, 'のデータをローカルストレージに保存しました:', updatedData);
}

// ローカルストレージからフォームデータを復元
function restoreFormData() {
    // 自動計算フラグをリセット
    autoCalculationExecuted = false;
    
    const savedData = localStorage.getItem('simulationFormData');
    if (savedData) {
        try {
            const parsedData = JSON.parse(savedData);
            formData = Object.assign({}, formData, parsedData);
            console.log('ローカルストレージからフォームデータを復元しました:', formData);
            
            // 現在のページに応じてフォーム要素に値を設定
            const currentPage = getCurrentPageNumber();
            
            if (currentPage === 1) {
                // ステップ1の復元
                if (formData.prefecture) {
                    const prefectureSelect = document.getElementById('prefecture');
                    if (prefectureSelect) {
                        prefectureSelect.value = formData.prefecture;
                        // 都道府県選択イベントを発火して地点データを読み込む
                        prefectureSelect.dispatchEvent(new Event('change'));
                    }
                }
                if (formData.location) {
                    // 地点データが読み込まれた後に値を設定
                    setTimeout(() => {
                        const locationSelect = document.getElementById('location-select');
                        if (locationSelect) {
                            locationSelect.value = formData.location;
                        }
                    }, 1000);
                }
            } else if (currentPage === 2) {
                // ステップ2の復元
                if (formData.utilityCompany) {
                    const utilitySelect = document.getElementById('utility-company');
                    if (utilitySelect) {
                        utilitySelect.value = formData.utilityCompany;
                        // 電力会社選択イベントを発火
                        utilitySelect.dispatchEvent(new Event('change'));
                    }
                }
                if (formData.contractPlan) {
                    // 契約プランデータが読み込まれた後に値を設定
                    setTimeout(() => {
                        const contractSelect = document.getElementById('contract-plan');
                        if (contractSelect) {
                            contractSelect.value = formData.contractPlan;
                            contractSelect.dispatchEvent(new Event('change'));
                        }
                    }, 1000);
                }
                if (formData.usagePattern) {
                    // 電気使用形態データが読み込まれた後に値を設定
                    setTimeout(() => {
                        const usagePatternSelect = document.getElementById('usage-pattern');
                        if (usagePatternSelect) {
                            usagePatternSelect.value = formData.usagePattern;
                        }
                    }, 2000);
                }
                
                // 月別データの復元
                Object.keys(monthNames).forEach(key => {
                    if (formData[key]) {
                        const input = document.querySelector(`input[name="${key}"]`);
                        if (input) {
                            input.value = formData[key];
                        }
                    }
                });
            } else if (currentPage === 3) {
                // ステップ3の復元
                if (formData.moduleModel) {
                    // モジュールデータが読み込まれているかチェック
                    if (moduleData.length > 0) {
                        const moduleModelSelect = document.getElementById('module-model');
                        if (moduleModelSelect) {
                            moduleModelSelect.value = formData.moduleModel;
                            moduleModelSelect.dispatchEvent(new Event('change'));
                        }
                    } else {
                        // モジュールデータがまだ読み込まれていない場合は少し待ってから再試行
                        setTimeout(() => {
                            if (moduleData.length > 0) {
                                const moduleModelSelect = document.getElementById('module-model');
                                if (moduleModelSelect) {
                                    moduleModelSelect.value = formData.moduleModel;
                                    moduleModelSelect.dispatchEvent(new Event('change'));
                                }
                            }
                        }, 500);
                    }
                }
                if (formData.moduleQuantity) {
                    const moduleQuantityInput = document.getElementById('module-quantity');
                    if (moduleQuantityInput) {
                        moduleQuantityInput.value = formData.moduleQuantity;
                    }
                }
                if (formData.installationFace) {
                    const installationFaceSelect = document.getElementById('installation-face');
                    if (installationFaceSelect) {
                        installationFaceSelect.value = formData.installationFace;
                    }
                }
                if (formData.roofAngle) {
                    // 屋根の傾斜角度データが読み込まれているかチェック
                    if (roofAngleData.length > 0) {
                        const roofAngleSelect = document.getElementById('roof-angle');
                        if (roofAngleSelect) {
                            roofAngleSelect.value = formData.roofAngle;
                        }
                    } else {
                        // 屋根の傾斜角度データがまだ読み込まれていない場合は少し待ってから再試行
                        setTimeout(() => {
                            if (roofAngleData.length > 0) {
                                const roofAngleSelect = document.getElementById('roof-angle');
                                if (roofAngleSelect) {
                                    roofAngleSelect.value = formData.roofAngle;
                                }
                            }
                        }, 500);
                    }
                }
            } else if (currentPage === 4) {
                // ステップ4の復元
                // モジュール合計枚数の表示を更新
                const totalModulesDisplay = document.getElementById('total-modules-display');
                if (totalModulesDisplay && formData.moduleQuantity) {
                    totalModulesDisplay.textContent = `${formData.moduleQuantity}枚`;
                    console.log('ステップ4: モジュール合計枚数を表示しました:', formData.moduleQuantity);
                }
            } else if (currentPage === 5) {
                // ステップ5の復元
                if (formData.batteryModel) {
                    // 蓄電池データが読み込まれた後に値を設定
                    setTimeout(() => {
                        const batteryModelSelect = document.getElementById('battery-model');
                        if (batteryModelSelect) {
                            batteryModelSelect.value = formData.batteryModel;
                        }
                    }, 1000);
                }
            }
        } catch (error) {
            console.error('ローカルストレージからのデータ復元に失敗しました:', error);
        }
    }
}

// 現在のステップのバリデーション
function validateCurrentStep() {
    const currentPage = getCurrentPageNumber();
    
    // ステップ1の特別なバリデーション
    if (currentPage === 1) {
        return validateStep1();
    }
    
    // ステップ2の特別なバリデーション
    if (currentPage === 2) {
        return validateStep2();
    }
    
    // ステップ3の特別なバリデーション
    if (currentPage === 3) {
        return validateStep3();
    }
    
    // ステップ4の特別なバリデーション
    if (currentPage === 4) {
        return validateStep4();
    }
    
    const currentStepElement = document.querySelector(`[data-step="${currentPage}"]`);
    if (!currentStepElement) return true; // 要素が存在しない場合はバリデーションをスキップ
    
    const requiredFields = currentStepElement.querySelectorAll('[required]');
    
    for (let field of requiredFields) {
        if (!field.value.trim()) {
            alert(`${field.previousElementSibling.textContent}を入力してください。`);
            field.focus();
            return false;
        }
    }
    
    return true;
}

// ステップ1の特別なバリデーション
function validateStep1() {
    const prefectureSelect = document.getElementById('prefecture');
    const locationSelect = document.getElementById('location-select');
    const prefectureGroup = document.getElementById('prefecture-group');
    const locationGroup = document.getElementById('location-group');
    const prefectureError = document.getElementById('prefecture-error');
    const locationError = document.getElementById('location-error');
    
    // エラー状態をリセット
    clearStep1Errors();
    
    let errorMessage = '';
    let focusElement = null;
    let hasError = false;
    
    // 都道府県のチェック
    if (!prefectureSelect || !prefectureSelect.value || prefectureSelect.value === '') {
        errorMessage += '・都道府県を選択してください。\n';
        focusElement = prefectureSelect;
        hasError = true;
        
        // 視覚的なエラー表示
        if (prefectureGroup) {
            prefectureGroup.classList.add('error');
        }
        if (prefectureError) {
            prefectureError.textContent = '都道府県を選択してください';
            prefectureError.style.display = 'block';
        }
    }
    
    // 地点のチェック
    if (!locationSelect || !locationSelect.value || locationSelect.value === '') {
        errorMessage += '・地点を選択してください。\n';
        if (!focusElement) {
            focusElement = locationSelect;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (locationGroup) {
            locationGroup.classList.add('error');
        }
        if (locationError) {
            locationError.textContent = '地点を選択してください';
            locationError.style.display = 'block';
        }
    }
    
    // エラーがある場合は忠告を表示
    if (hasError) {
        const fullMessage = '以下の必須項目を入力してください：\n\n' + errorMessage + '\nすべての必須項目を入力してから次へ進んでください。';
        alert(fullMessage);
        
        // 最初のエラー要素にフォーカス
        if (focusElement) {
            focusElement.focus();
        }
        
        return false;
    }
    
    return true;
}

// ステップ1のエラー表示をクリア
function clearStep1Errors() {
    const prefectureGroup = document.getElementById('prefecture-group');
    const locationGroup = document.getElementById('location-group');
    const prefectureError = document.getElementById('prefecture-error');
    const locationError = document.getElementById('location-error');
    
    if (prefectureGroup) {
        prefectureGroup.classList.remove('error');
    }
    if (locationGroup) {
        locationGroup.classList.remove('error');
    }
    if (prefectureError) {
        prefectureError.style.display = 'none';
        prefectureError.textContent = '';
    }
    if (locationError) {
        locationError.style.display = 'none';
        locationError.textContent = '';
    }
}

// ステップ2の特別なバリデーション
function validateStep2() {
    const utilitySelect = document.getElementById('utility-company');
    const contractSelect = document.getElementById('contract-plan');
    const usagePatternSelect = document.getElementById('usage-pattern');
    const utilityGroup = document.getElementById('utility-group');
    const contractGroup = document.getElementById('contract-group');
    const usagePatternGroup = document.getElementById('usage-pattern-group');
    const monthlyDataGroup = document.getElementById('monthly-data-group');
    const utilityError = document.getElementById('utility-error');
    const contractError = document.getElementById('contract-error');
    const usagePatternError = document.getElementById('usage-pattern-error');
    const monthlyDataError = document.getElementById('monthly-data-error');
    
    // エラー状態をリセット
    clearStep2Errors();
    
    let errorMessage = '';
    let focusElement = null;
    let hasError = false;
    
    // 電力会社のチェック
    if (!utilitySelect || !utilitySelect.value || utilitySelect.value === '') {
        errorMessage += '・電力会社を選択してください。\n';
        focusElement = utilitySelect;
        hasError = true;
        
        // 視覚的なエラー表示
        if (utilityGroup) {
            utilityGroup.classList.add('error');
        }
        if (utilityError) {
            utilityError.textContent = '電力会社を選択してください';
            utilityError.style.display = 'block';
        }
    }
    
    // 契約プランのチェック
    if (!contractSelect || !contractSelect.value || contractSelect.value === '') {
        errorMessage += '・契約プランを選択してください。\n';
        if (!focusElement) {
            focusElement = contractSelect;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (contractGroup) {
            contractGroup.classList.add('error');
        }
        if (contractError) {
            contractError.textContent = '契約プランを選択してください';
            contractError.style.display = 'block';
        }
    }
    
    // 電気使用形態のチェック
    if (!usagePatternSelect || !usagePatternSelect.value || usagePatternSelect.value === '') {
        errorMessage += '・電気使用形態を選択してください。\n';
        if (!focusElement) {
            focusElement = usagePatternSelect;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (usagePatternGroup) {
            usagePatternGroup.classList.add('error');
        }
        if (usagePatternError) {
            usagePatternError.textContent = '電気使用形態を選択してください';
            usagePatternError.style.display = 'block';
        }
    }
    
    // 月別データのチェック（24項目すべての入力確認）
    const monthlyInputs = document.querySelectorAll('input[name^="usage_"], input[name^="bill_"]');
    let hasMonthlyData = false;
    let allMonthlyDataComplete = true;
    let monthlyDataErrors = [];
    
    // 各月の使用量と料金のペアをチェック
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    const monthNames = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    for (let i = 0; i < months.length; i++) {
        const month = months[i];
        const monthName = monthNames[i];
        const usageInput = document.querySelector(`input[name="usage_${month}"]`);
        const billInput = document.querySelector(`input[name="bill_${month}"]`);
        
        const usageValue = usageInput ? usageInput.value.trim() : '';
        const billValue = billInput ? billInput.value.trim() : '';
        
        // どちらか一方だけ入力されている場合はエラー
        if ((usageValue && !billValue) || (!usageValue && billValue)) {
            monthlyDataErrors.push(`${monthName}の使用量と料金の両方を入力してください`);
            allMonthlyDataComplete = false;
        }
        
        // 両方入力されている場合は有効なデータとしてカウント
        if (usageValue && billValue) {
            hasMonthlyData = true;
        } else {
            // どちらかが未入力の場合は24項目すべて完了していない
            allMonthlyDataComplete = false;
        }
    }
    
    // 最低1ヶ月分のデータがない場合
    if (!hasMonthlyData) {
        errorMessage += '・最低1ヶ月分の電気使用量と電気料金を入力してください。\n';
        hasError = true;
        
        // 視覚的なエラー表示
        if (monthlyDataGroup) {
            monthlyDataGroup.classList.add('error');
        }
        if (monthlyDataError) {
            monthlyDataError.textContent = '最低1ヶ月分の電気使用量と電気料金を入力してください';
            monthlyDataError.style.display = 'block';
        }
    } else {
        // 24項目すべてが入力されている場合は自動計算不要
        if (allMonthlyDataComplete) {
            // 24項目すべて入力済みの場合は何もしない（バリデーション成功）
        } else {
            // 一部の月が未入力で、自動計算が実行されていない場合
            if (!autoCalculationExecuted) {
                errorMessage += '・「自動計算」ボタンをクリックして、すべての月のデータを計算してください。\n';
                hasError = true;
                
                // 視覚的なエラー表示
                if (monthlyDataGroup) {
                    monthlyDataGroup.classList.add('error');
                }
                if (monthlyDataError) {
                    monthlyDataError.textContent = '「自動計算」ボタンをクリックして、すべての月のデータを計算してください';
                    monthlyDataError.style.display = 'block';
                }
            }
        }
    }
    
    // 月別データの入力不整合がある場合
    if (monthlyDataErrors.length > 0) {
        errorMessage += '・月別データの入力に不整合があります：\n';
        monthlyDataErrors.forEach(error => {
            errorMessage += `  ${error}\n`;
        });
        hasError = true;
        
        // 視覚的なエラー表示
        if (monthlyDataGroup) {
            monthlyDataGroup.classList.add('error');
        }
        if (monthlyDataError) {
            monthlyDataError.textContent = monthlyDataErrors.join('、');
            monthlyDataError.style.display = 'block';
        }
    }
    
    // エラーがある場合は忠告を表示
    if (hasError) {
        const fullMessage = '以下の項目を入力してください：\n\n' + errorMessage + '\nすべての項目を正しく入力してから次へ進んでください。';
        alert(fullMessage);
        
        // 最初のエラー要素にフォーカス
        if (focusElement) {
            focusElement.focus();
        }
        
        return false;
    }
    
    return true;
}

// ステップ2のエラー表示をクリア
function clearStep2Errors() {
    const utilityGroup = document.getElementById('utility-group');
    const contractGroup = document.getElementById('contract-group');
    const usagePatternGroup = document.getElementById('usage-pattern-group');
    const monthlyDataGroup = document.getElementById('monthly-data-group');
    const utilityError = document.getElementById('utility-error');
    const contractError = document.getElementById('contract-error');
    const usagePatternError = document.getElementById('usage-pattern-error');
    const monthlyDataError = document.getElementById('monthly-data-error');
    
    if (utilityGroup) {
        utilityGroup.classList.remove('error');
    }
    if (contractGroup) {
        contractGroup.classList.remove('error');
    }
    if (usagePatternGroup) {
        usagePatternGroup.classList.remove('error');
    }
    if (monthlyDataGroup) {
        monthlyDataGroup.classList.remove('error');
    }
    if (utilityError) {
        utilityError.style.display = 'none';
    }
    if (contractError) {
        contractError.style.display = 'none';
    }
    if (usagePatternError) {
        usagePatternError.style.display = 'none';
    }
    if (monthlyDataError) {
        monthlyDataError.style.display = 'none';
    }
}

// 自動計算機能
function autoCalculateMonthlyData() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let inputCount = 0;
    let totalUsage = 0;
    let totalBill = 0;
    let inputMonths = [];
    
    // 入力されたデータを収集
    for (const month of months) {
        const usageInput = document.querySelector(`input[name="usage_${month}"]`);
        const billInput = document.querySelector(`input[name="bill_${month}"]`);
        
        if (usageInput && billInput) {
            const usageValue = usageInput.value.trim();
            const billValue = billInput.value.trim();
            
            if (usageValue && billValue) {
                const usage = parseFloat(usageValue);
                const bill = parseFloat(billValue);
                
                if (!isNaN(usage) && !isNaN(bill) && usage > 0 && bill > 0) {
                    totalUsage += usage;
                    totalBill += bill;
                    inputCount++;
                    inputMonths.push(month);
                }
            }
        }
    }
    
    // ケースB: 1ヶ月も入力がない場合
    if (inputCount === 0) {
        alert('最低1ヶ月分の電気使用量と電気料金を入力してください。\n\n自動計算を行うには、少なくとも1ヶ月分のデータが必要です。');
        return;
    }
    
    // ケースA: 1ヶ月分以上の入力がある場合
    const averageUsage = totalUsage / inputCount;
    const averageBill = totalBill / inputCount;
    
    // 年間推定値の計算
    const estimatedYearlyUsage = averageUsage * 12;
    const estimatedYearlyBill = averageBill * 12;
    
    // 各月の値を計算して入力欄に反映
    for (const month of months) {
        const usageInput = document.querySelector(`input[name="usage_${month}"]`);
        const billInput = document.querySelector(`input[name="bill_${month}"]`);
        
        if (usageInput && billInput) {
            const ratio = monthlyRatios[month];
            const calculatedUsage = Math.round(estimatedYearlyUsage * ratio);
            const calculatedBill = Math.round(estimatedYearlyBill * ratio);
            
            usageInput.value = calculatedUsage;
            billInput.value = calculatedBill;
            
            // 入力イベントを発火させてフォームデータを更新
            usageInput.dispatchEvent(new Event('input', { bubbles: true }));
            billInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    // 自動計算実行フラグを設定
    autoCalculationExecuted = true;
    
    // 成功メッセージを表示
    const inputMonthNames = inputMonths.map(month => monthNames[`usage_${month}`]).join('、');
    alert(`自動計算が完了しました。\n\n入力された月: ${inputMonthNames}\n年間推定使用量: ${Math.round(estimatedYearlyUsage)} kWh\n年間推定電気料金: ${Math.round(estimatedYearlyBill)} 円\n\nすべての月のデータが季節変動に基づいて計算されました。`);
}

// 月別データをクリアする関数
function clearMonthlyData() {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    
    // 1月から12月までのすべての電気使用量と電気料金の入力欄をクリア
    for (const month of months) {
        const usageInput = document.querySelector(`input[name="usage_${month}"]`);
        const billInput = document.querySelector(`input[name="bill_${month}"]`);
        
        if (usageInput) {
            usageInput.value = '';
            // 入力イベントを発火させてフォームデータを更新
            usageInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
        
        if (billInput) {
            billInput.value = '';
            // 入力イベントを発火させてフォームデータを更新
            billInput.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }
    
    // 自動計算実行フラグをリセット
    autoCalculationExecuted = false;
    
    // 成功メッセージを表示
    alert('月別データをクリアしました。\n\nすべての月の電気使用量と電気料金の入力欄が空になりました。');
}

// ステップ3の特別なバリデーション
function validateStep3() {
    const moduleModelSelect = document.getElementById('module-model');
    const moduleQuantityInput = document.getElementById('module-quantity');
    const installationFaceSelect = document.getElementById('installation-face');
    const roofAngleSelect = document.getElementById('roof-angle');
    const moduleModelGroup = document.getElementById('module-model-group');
    const moduleQuantityGroup = document.getElementById('module-quantity-group');
    const installationFaceGroup = document.getElementById('installation-face-group');
    const roofAngleGroup = document.getElementById('roof-angle-group');
    const moduleModelError = document.getElementById('module-model-error');
    const moduleQuantityError = document.getElementById('module-quantity-error');
    const installationFaceError = document.getElementById('installation-face-error');
    const roofAngleError = document.getElementById('roof-angle-error');
    
    // エラー状態をリセット
    clearStep3Errors();
    
    let errorMessage = '';
    let focusElement = null;
    let hasError = false;
    
    // モジュール型式のチェック
    if (!moduleModelSelect || !moduleModelSelect.value || moduleModelSelect.value === '') {
        errorMessage += '・モジュール型式を選択してください。\n';
        focusElement = moduleModelSelect;
        hasError = true;
        
        // 視覚的なエラー表示
        if (moduleModelGroup) {
            moduleModelGroup.classList.add('error');
        }
        if (moduleModelError) {
            moduleModelError.textContent = 'モジュール型式を選択してください';
            moduleModelError.style.display = 'block';
        }
    }
    
    // 枚数のチェック
    if (!moduleQuantityInput || !moduleQuantityInput.value || moduleQuantityInput.value === '') {
        errorMessage += '・枚数を入力してください。\n';
        if (!focusElement) {
            focusElement = moduleQuantityInput;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (moduleQuantityGroup) {
            moduleQuantityGroup.classList.add('error');
        }
        if (moduleQuantityError) {
            moduleQuantityError.textContent = '枚数を入力してください';
            moduleQuantityError.style.display = 'block';
        }
    } else {
        const quantity = parseInt(moduleQuantityInput.value);
        if (isNaN(quantity) || quantity < 3 || quantity > 60) {
            errorMessage += '・枚数は3枚以上60枚以下で入力してください。\n';
            if (!focusElement) {
                focusElement = moduleQuantityInput;
            }
            hasError = true;
            
            // 視覚的なエラー表示
            if (moduleQuantityGroup) {
                moduleQuantityGroup.classList.add('error');
            }
            if (moduleQuantityError) {
                moduleQuantityError.textContent = '枚数は3枚以上60枚以下で入力してください';
                moduleQuantityError.style.display = 'block';
            }
        }
    }
    
    // 設置面のチェック
    if (!installationFaceSelect || !installationFaceSelect.value || installationFaceSelect.value === '') {
        errorMessage += '・設置面を選択してください。\n';
        if (!focusElement) {
            focusElement = installationFaceSelect;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (installationFaceGroup) {
            installationFaceGroup.classList.add('error');
        }
        if (installationFaceError) {
            installationFaceError.textContent = '設置面を選択してください';
            installationFaceError.style.display = 'block';
        }
    }
    
    // 屋根の傾斜角度のチェック
    if (!roofAngleSelect || !roofAngleSelect.value || roofAngleSelect.value === '') {
        errorMessage += '・屋根の傾斜角度を選択してください。\n';
        if (!focusElement) {
            focusElement = roofAngleSelect;
        }
        hasError = true;
        
        // 視覚的なエラー表示
        if (roofAngleGroup) {
            roofAngleGroup.classList.add('error');
        }
        if (roofAngleError) {
            roofAngleError.textContent = '屋根の傾斜角度を選択してください';
            roofAngleError.style.display = 'block';
        }
    }
    
    // エラーがある場合は忠告を表示
    if (hasError) {
        const fullMessage = '以下の必須項目を入力してください：\n\n' + errorMessage + '\nすべての必須項目を正しく入力してから次へ進んでください。';
        alert(fullMessage);
        
        // 最初のエラー要素にフォーカス
        if (focusElement) {
            focusElement.focus();
        }
        
        return false;
    }
    
    return true;
}

// ステップ3のエラー表示をクリア
function clearStep3Errors() {
    const moduleModelGroup = document.getElementById('module-model-group');
    const moduleQuantityGroup = document.getElementById('module-quantity-group');
    const installationFaceGroup = document.getElementById('installation-face-group');
    const roofAngleGroup = document.getElementById('roof-angle-group');
    const moduleModelError = document.getElementById('module-model-error');
    const moduleQuantityError = document.getElementById('module-quantity-error');
    const installationFaceError = document.getElementById('installation-face-error');
    const roofAngleError = document.getElementById('roof-angle-error');
    
    if (moduleModelGroup) {
        moduleModelGroup.classList.remove('error');
    }
    if (moduleQuantityGroup) {
        moduleQuantityGroup.classList.remove('error');
    }
    if (installationFaceGroup) {
        installationFaceGroup.classList.remove('error');
    }
    if (roofAngleGroup) {
        roofAngleGroup.classList.remove('error');
    }
    if (moduleModelError) {
        moduleModelError.style.display = 'none';
    }
    if (moduleQuantityError) {
        moduleQuantityError.style.display = 'none';
    }
    if (installationFaceError) {
        installationFaceError.style.display = 'none';
    }
    if (roofAngleError) {
        roofAngleError.style.display = 'none';
    }
}

// ステップ4の特別なバリデーション
function validateStep4() {
    const inverterModelSelect = document.getElementById('inverter-model');
    const inverterQuantitySelect = document.getElementById('inverter-quantity');
    const seriesInput = document.getElementById('series-input');
    const parallelInput = document.getElementById('parallel-input');
    const validationMessage = document.getElementById('string-config-validation');
    
    // エラー状態をリセット
    clearStep4Errors();
    
    let errorMessage = '';
    let focusElement = null;
    let hasError = false;
    
    // パワーコンディショナ型式のチェック
    if (!inverterModelSelect || !inverterModelSelect.value || inverterModelSelect.value === '') {
        errorMessage += '・パワーコンディショナ型式を選択してください。\n';
        focusElement = inverterModelSelect;
        hasError = true;
    }
    
    // 台数のチェック
    if (!inverterQuantitySelect || !inverterQuantitySelect.value || inverterQuantitySelect.value === '') {
        errorMessage += '・台数を選択してください。\n';
        if (!focusElement) {
            focusElement = inverterQuantitySelect;
        }
        hasError = true;
    }
    
    // 直列枚数のチェック
    if (!seriesInput || !seriesInput.value || seriesInput.value === '') {
        errorMessage += '・直列枚数を入力してください。\n';
        if (!focusElement) {
            focusElement = seriesInput;
        }
        hasError = true;
    }
    
    // 並列数のチェック
    if (!parallelInput || !parallelInput.value || parallelInput.value === '') {
        errorMessage += '・並列数を入力してください。\n';
        if (!focusElement) {
            focusElement = parallelInput;
        }
        hasError = true;
    }
    
    // ストリング構成の検証
    if (seriesInput && parallelInput && seriesInput.value && parallelInput.value) {
        const series = parseInt(seriesInput.value);
        const parallel = parseInt(parallelInput.value);
        const totalModules = series * parallel;
        
        // ステップ3で選択されたモジュール合計枚数を取得（formDataから直接取得）
        const step3ModuleQuantity = formData.moduleQuantity || 0;
        
        // デバッグログを追加
        console.log('validateStep4 - ストリング構成検証:');
        console.log('  series:', series, 'type:', typeof series);
        console.log('  parallel:', parallel, 'type:', typeof parallel);
        console.log('  totalModules:', totalModules, 'type:', typeof totalModules);
        console.log('  step3ModuleQuantity:', step3ModuleQuantity, 'type:', typeof step3ModuleQuantity);
        
        // 型を統一して比較
        const step3ModuleQuantityNum = parseInt(step3ModuleQuantity);
        console.log('  step3ModuleQuantityNum:', step3ModuleQuantityNum, 'type:', typeof step3ModuleQuantityNum);
        console.log('  比較結果:', totalModules !== step3ModuleQuantityNum);
        
        if (totalModules !== step3ModuleQuantityNum) {
            errorMessage += `・ストリング構成が合計枚数と一致しません。\n`;
            errorMessage += `  直列枚数(${series}) × 並列数(${parallel}) = ${totalModules}枚\n`;
            errorMessage += `  選択されたモジュール合計枚数: ${step3ModuleQuantityNum}枚\n`;
            if (!focusElement) {
                focusElement = seriesInput;
            }
            hasError = true;
            
            // 検証メッセージを表示
            if (validationMessage) {
                validationMessage.textContent = `ストリング構成が合計枚数と一致しません。直列枚数(${series}) × 並列数(${parallel}) = ${totalModules}枚、選択されたモジュール合計枚数: ${step3ModuleQuantityNum}枚`;
                validationMessage.style.display = 'block';
                validationMessage.style.color = '#d32f2f';
            }
        } else {
            // 検証メッセージをクリア
            if (validationMessage) {
                validationMessage.style.display = 'none';
            }
        }
    }
    
    if (hasError) {
        alert(errorMessage);
        if (focusElement) {
            focusElement.focus();
        }
        return false;
    }
    
    return true;
}

// ステップ4のエラー表示をクリア
function clearStep4Errors() {
    const validationMessage = document.getElementById('string-config-validation');
    if (validationMessage) {
        validationMessage.style.display = 'none';
    }
}

// 現在のステップのデータを保存






// シミュレーション実行
function runSimulation() {
    const resultsContent = document.getElementById('simulation-results-content');
    if (!resultsContent) return; // 要素が存在しない場合は何もしない
    
    resultsContent.innerHTML = '<p>シミュレーションを実行中...</p>';
    
    // 入力内容の確認を表示
    displayInputSummary();
    
    // ローカルストレージからフォームデータを取得
    const savedData = localStorage.getItem('simulationFormData');
    if (!savedData) {
        resultsContent.innerHTML = '<p style="color: red;">フォームデータが見つかりません。最初からやり直してください。</p>';
        return;
    }
    
    try {
        const formData = JSON.parse(savedData);
        
        // デバッグ: 送信するデータをログに出力
        console.log('送信するフォームデータ:', formData);
        console.log('地点データ:', formData.location);
        
        // APIエンドポイントにPOSTリクエストを送信
        fetch('/api/simulate', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(formData)
        })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            if (data.error) {
                resultsContent.innerHTML = `<p style="color: red;">エラー: ${data.error}</p>`;
                return;
            }
            
            // 計算結果を表示
            resultsContent.innerHTML = `
                <div style="text-align: center;">
                    <h4 style="color: #2c3e50; margin-bottom: 1.5em;">シミュレーション完了</h4>
                    
                    <!-- 年間発電量 -->
                    <div style="background: linear-gradient(135deg, #e3f2fd 0%, #bbdefb 100%); padding: 25px; border-radius: 12px; margin: 15px 0; border: 2px solid #2196f3;">
                        <strong style="font-size: 1.3em; color: #1565c0;">年間発電量</strong><br>
                        <span style="font-size: 2em; font-weight: bold; color: #0d47a1;">${data.estimated_generation.toLocaleString()} kWh/年</span><br>
                        <small style="color: #1565c0;"></small>
                    </div>
                    
                    <!-- 月別発電量グラフ -->
                    <div style="background: #fff; padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid #dee2e6; box-shadow: 0 2px 8px rgba(0,0,0,0.1);">
                        <h5 style="color: #495057; margin-bottom: 1em; font-size: 1.2em;">月別発電量</h5>
                        <p style="color: #666; font-size: 0.9em; margin-bottom: 1em;">
                            NEDO気象データの8760時間（365日×24時間）のデータを使用した高精度な計算結果です。
                        </p>
                        <div style="position: relative; height: 400px; width: 100%; margin: 0 auto;">
                            <canvas id="monthlyGenerationChart" style="max-height: 400px; width: 100% !important; height: 100% !important;"></canvas>
                        </div>
                    </div>
                    
                    <!-- 1日の電力の流れグラフ -->
                    <div class="power-flow-chart-section">
                        <h3>1日の電力の流れ</h3>
                        <div class="chart-container" style="position: relative; height: 400px; width: 100%;">
                            <canvas id="powerFlowChart"></canvas>
                        </div>
                    </div>
                    

                    

                    
                    <!-- 発電量の内訳 -->
                    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0;">
                        <div style="background: linear-gradient(135deg, #e8f5e8 0%, #c8e6c9 100%); padding: 20px; border-radius: 10px; border: 2px solid #4caf50;">
                            <strong style="font-size: 1.1em; color: #2e7d32;">自家消費量</strong><br>
                            <span style="font-size: 1.4em; font-weight: bold; color: #1b5e20;">${data.annual_self_consumption.toLocaleString()} kWh/年</span><br>
                            <span style="font-size: 1.1em; font-weight: bold; color: #2e7d32; background: rgba(255,255,255,0.7); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">
                                ${((data.annual_self_consumption / data.estimated_generation) * 100).toFixed(1)}%
                            </span>
                        </div>
                        <div style="background: linear-gradient(135deg, #fff3e0 0%, #ffcc02 100%); padding: 20px; border-radius: 10px; border: 2px solid #ff9800;">
                            <strong style="font-size: 1.1em; color: #e65100;">売電量</strong><br>
                            <span style="font-size: 1.4em; font-weight: bold; color: #bf360c;">${data.annual_sell_electricity.toLocaleString()} kWh/年</span><br>
                            <span style="font-size: 1.1em; font-weight: bold; color: #e65100; background: rgba(255,255,255,0.7); padding: 2px 8px; border-radius: 4px; display: inline-block; margin-top: 5px;">
                                ${((data.annual_sell_electricity / data.estimated_generation) * 100).toFixed(1)}%
                            </span>
                        </div>
                    </div>
                    
                    <!-- 経済効果の詳細 -->
                    <div style="background: #f8f9fa; padding: 25px; border-radius: 12px; margin: 20px 0; border: 2px solid #dee2e6;">
                        <h5 style="color: #495057; margin-bottom: 1em; font-size: 1.2em;">経済効果の詳細（1年目）</h5>
                        
                        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-bottom: 20px;">
                            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #4caf50;">
                                <strong style="font-size: 1.1em; color: #2e7d32;">自家消費による節約額</strong><br>
                                <span style="font-size: 1.3em; font-weight: bold; color: #1b5e20;">${data.annual_self_consumption_savings.toLocaleString()}円/年</span><br>
                                <small style="color: #666;">
                                    ${data.annual_self_consumption.toLocaleString()} kWh × ${data.buy_price_per_kwh}円/kWh
                                </small>
                            </div>
                            <div style="background: white; padding: 20px; border-radius: 8px; border-left: 4px solid #ff9800;">
                                <strong style="font-size: 1.1em; color: #e65100;">売電収入（1年目）</strong><br>
                                <span style="font-size: 1.3em; font-weight: bold; color: #bf360c;">${data.annual_sell_revenue.toLocaleString()}円/年</span><br>
                                <small style="color: #666;">
                                    ${data.annual_sell_electricity.toLocaleString()} kWh × ${data.sell_price_per_kwh}円/kWh
                                </small>
                            </div>
                        </div>
                        
                        <!-- 合計経済効果 -->
                        <div style="background: linear-gradient(135deg, #e8f5e8 0%, #4caf50 100%); padding: 25px; border-radius: 10px; border: 2px solid #2e7d32;">
                            <strong style="font-size: 1.4em; color: white;">年間総経済効果（1年目）</strong><br>
                            <span style="font-size: 2.2em; font-weight: bold; color: white;">${data.total_economic_effect.toLocaleString()}円/年</span><br>
                            <small style="color: #e8f5e8;">
                                節約額 + 売電収入
                            </small>
                        </div>
                    </div>
                    

                </div>
            `;
            
            // 月別発電量グラフを描画
            if (data.monthly_generation && data.monthly_generation.length === 12) {
                drawMonthlyGenerationChart(data.monthly_generation);
            }
            
            // 1日の電力の流れグラフを描画
            if (data.hourly_generation && data.hourly_self_consumption && data.hourly_surplus_power) {
                drawPowerFlowChart(data.hourly_generation, data.hourly_self_consumption, data.hourly_surplus_power);
            }
            

            

            
            // 蓄電池の充放電パターングラフを描画
            if (data.battery_pattern && data.battery_pattern.has_battery) {
                drawBatteryPatternChart(data.battery_pattern);
            }
            
            // 蓄電池ありなしの比較グラフを描画
            if (data.battery_comparison) {
                drawBatteryComparisonChart(data.battery_comparison);
            }
            
            // 蓄電池詳細情報を表示
            if (data.battery_pattern && data.battery_pattern.has_battery && data.battery_comparison) {
                displayBatteryDetails(data.battery_pattern, data.battery_comparison);
            }
            
            // 10年間の経済効果テーブルを表示
            if (data.yearly_breakdown && data.yearly_breakdown.length > 0) {
                displayYearlyEconomicEffectsTable(data.yearly_breakdown, data.total_10year_effect);
            }
        })
        .catch(error => {
            console.error('シミュレーション実行エラー:', error);
            resultsContent.innerHTML = `
                <div style="text-align: center; color: red;">
                    <h4>シミュレーション実行エラー</h4>
                    <p>シミュレーションの実行中にエラーが発生しました。</p>
                    <p>エラー詳細: ${error.message}</p>
                    <button onclick="runSimulation()" style="margin-top: 10px; padding: 10px 20px; background: #2196F3; color: white; border: none; border-radius: 4px; cursor: pointer;">
                        再試行
                    </button>
                </div>
            `;
        });
        
    } catch (error) {
        console.error('フォームデータ解析エラー:', error);
        resultsContent.innerHTML = '<p style="color: red;">フォームデータの解析中にエラーが発生しました。</p>';
    }
}

// 月別発電量グラフを描画する関数
function drawMonthlyGenerationChart(monthlyData) {
    const canvas = document.getElementById('monthlyGenerationChart');
    if (!canvas) {
        console.warn('月別発電量グラフのcanvas要素が見つかりません');
        return;
    }
    
    // 既存のグラフがある場合は破棄
    if (window.monthlyGenerationChart && typeof window.monthlyGenerationChart.destroy === 'function') {
        window.monthlyGenerationChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // 月名の配列
    const monthLabels = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];
    
    // グラフの色設定
    const backgroundColor = 'rgba(54, 162, 235, 0.2)';
    const borderColor = 'rgba(54, 162, 235, 1)';
    const hoverBackgroundColor = 'rgba(54, 162, 235, 0.4)';
    
    // Chart.jsでグラフを作成
    try {
        window.monthlyGenerationChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: monthLabels,
            datasets: [{
                label: '発電量 (kWh)',
                data: monthlyData,
                backgroundColor: backgroundColor,
                borderColor: borderColor,
                borderWidth: 2,
                hoverBackgroundColor: hoverBackgroundColor,
                borderRadius: 4,
                borderSkipped: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                title: {
                    display: true,
                    text: '月別発電量（1時間単位計算）',
                    font: {
                        size: 16,
                        weight: 'bold'
                    },
                    color: '#2c3e50'
                },
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12
                        },
                        color: '#2c3e50'
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    titleColor: 'white',
                    bodyColor: 'white',
                    borderColor: 'rgba(255, 255, 255, 0.2)',
                    borderWidth: 1,
                    cornerRadius: 6,
                    displayColors: false,
                    callbacks: {
                        label: function(context) {
                            return `発電量: ${context.parsed.y.toLocaleString()} kWh`;
                        }
                    }
                }
            },
            scales: {
                x: {
                    title: {
                        display: true,
                        text: '月',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#2c3e50'
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    }
                },
                y: {
                    title: {
                        display: true,
                        text: '発電量 (kWh)',
                        font: {
                            size: 14,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    },
                    ticks: {
                        font: {
                            size: 12
                        },
                        color: '#2c3e50',
                        callback: function(value) {
                            return value.toLocaleString();
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.1)'
                    },
                    beginAtZero: true
                }
            },
            animation: {
                duration: 1000,
                easing: 'easeInOutQuart'
            },
            interaction: {
                intersect: false,
                mode: 'index'
            }
        }
    });
    } catch (error) {
        console.error('月別発電量グラフの作成に失敗しました:', error);
        // エラーが発生した場合は、既存のグラフインスタンスをクリア
        window.monthlyGenerationChart = null;
    }
}



// 1日の時間別自家消費量グラフを描画する関数




// 入力内容の確認を表示
function displayInputSummary() {
    const summaryContent = document.getElementById('input-summary-content');
    if (!summaryContent) return; // 要素が存在しない場合は何もしない
    
    let summaryHTML = '';
    
    // ステップ1: 場所の選択
    if (formData.prefecture) {
        summaryHTML += `<div><strong>都道府県:</strong> ${formData.prefecture}</div>`;
    }
    if (formData.location) {
        summaryHTML += `<div><strong>地点:</strong> ${formData.location}</div>`;
    }
    
    // ステップ2: 電気契約の選択
    if (formData.utilityCompany) {
        summaryHTML += `<div><strong>電力会社:</strong> ${formData.utilityCompany}</div>`;
    }
    if (formData.contractPlan) {
        summaryHTML += `<div><strong>契約プラン:</strong> ${formData.contractPlan}</div>`;
    }
    if (formData.usagePattern) {
        summaryHTML += `<div><strong>電気使用形態:</strong> ${formData.usagePattern}</div>`;
    }
    
    // 月別電気使用量・料金データ
    const monthlyData = [];
    Object.keys(monthNames).forEach(key => {
        if (formData[key]) {
            const month = monthNames[key];
            const isUsage = key.startsWith('usage_');
            const type = isUsage ? '電気使用量' : '電気料金';
            const unit = isUsage ? 'kWh' : '円';
            
            // 同じ月のデータをグループ化
            const existingIndex = monthlyData.findIndex(item => item.month === month);
            if (existingIndex >= 0) {
                monthlyData[existingIndex][type] = `${formData[key]}${unit}`;
            } else {
                monthlyData.push({
                    month: month,
                    [type]: `${formData[key]}${unit}`
                });
            }
        }
    });
    
    if (monthlyData.length > 0) {
        summaryHTML += `<div><strong>月別電気使用量・料金:</strong></div>`;
        monthlyData.forEach(data => {
            summaryHTML += `<div style="margin-left: 1em;">`;
            summaryHTML += `<strong>${data.month}:</strong> `;
            if (data['電気使用量']) summaryHTML += `使用量 ${data['電気使用量']}`;
            if (data['電気使用量'] && data['電気料金']) summaryHTML += `, `;
            if (data['電気料金']) summaryHTML += `料金 ${data['電気料金']}`;
            summaryHTML += `</div>`;
        });
    }
    
    // ステップ3: 太陽電池の選択
    if (formData.moduleModel) {
        summaryHTML += `<div><strong>モジュール型式:</strong> ${formData.moduleModel}</div>`;
    }
    if (formData.moduleQuantity) {
        summaryHTML += `<div><strong>枚数:</strong> ${formData.moduleQuantity}</div>`;
    }
    if (formData.installationFace) {
        summaryHTML += `<div><strong>設置面:</strong> ${formData.installationFace}</div>`;
    }
    if (formData.roofAngle) {
        summaryHTML += `<div><strong>屋根の傾斜角度:</strong> ${formData.roofAngle}</div>`;
    }
    
    // ステップ4: 周辺機器の選択
    if (formData.inverterModel) {
        summaryHTML += `<div><strong>パワーコンディショナ型式:</strong> ${formData.inverterModel}</div>`;
    }
    if (formData.inverterQuantity) {
        summaryHTML += `<div><strong>ストリング数:</strong> ${formData.inverterQuantity}</div>`;
    }
    
    // ステップ5: 蓄電池の選択
    if (formData.batteryModel) {
        summaryHTML += `<div><strong>蓄電池型式:</strong> ${formData.batteryModel}</div>`;
    } else {
        summaryHTML += `<div><strong>蓄電池:</strong> なし</div>`;
    }
    
    summaryContent.innerHTML = summaryHTML;
}

// シミュレーションを最初からやり直す
function restartSimulation() {
    formData = {};
    // ローカルストレージもクリア
    localStorage.removeItem('simulationFormData');
    window.location.href = '/simulation_form_1';
}

// 月別データの平均値を計算する関数
function calculateMonthlyAverages(formData) {
    const months = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
    let totalUsage = 0;
    let totalBill = 0;
    let validDataCount = 0;
    
    // 各月のデータを集計
    for (const month of months) {
        const usageKey = `usage_${month}`;
        const billKey = `bill_${month}`;
        
        if (formData[usageKey] && formData[billKey]) {
            const usage = parseFloat(formData[usageKey]);
            const bill = parseFloat(formData[billKey]);
            
            if (!isNaN(usage) && !isNaN(bill) && usage > 0 && bill > 0) {
                totalUsage += usage;
                totalBill += bill;
                validDataCount++;
            }
        }
    }
    
    // 有効なデータがない場合はnullを返す
    if (validDataCount === 0) {
        return null;
    }
    
    // 平均値を計算
    const averageUsage = Math.round(totalUsage / validDataCount);
    const averageBill = Math.round(totalBill / validDataCount);
    
    // 年間推定値を計算
    const yearlyUsage = Math.round(averageUsage * 12);
    const yearlyBill = Math.round(averageBill * 12);
    
    return {
        averageUsage: averageUsage,
        averageBill: averageBill,
        yearlyUsage: yearlyUsage,
        yearlyBill: yearlyBill,
        validDataCount: validDataCount
    };
}

// 入力内容の確認を表示する関数
function displayInputSummary() {
    const summaryContent = document.getElementById('input-summary-content');
    if (!summaryContent) {
        console.warn('input-summary-content要素が見つかりません');
        return;
    }

    // ローカルストレージからフォームデータを取得
    const savedData = localStorage.getItem('simulationFormData');
    if (!savedData) {
        summaryContent.innerHTML = '<p style="color: red;">入力データが見つかりません。</p>';
        return;
    }

    try {
        const formData = JSON.parse(savedData);
        let summaryHTML = '<div class="input-summary-grid">';

        // ステップ1: 場所の選択
        summaryHTML += '<div class="summary-section">';
        summaryHTML += '<h4>場所の選択</h4>';
        if (formData.prefecture) {
            summaryHTML += `<div class="summary-item"><strong>都道府県</strong><span>${formData.prefecture}</span></div>`;
        }
        if (formData.location) {
            summaryHTML += `<div class="summary-item"><strong>地点</strong><span>${formData.location}</span></div>`;
        }
        summaryHTML += '</div>';

        // ステップ2: 電気契約の選択
        summaryHTML += '<div class="summary-section">';
        summaryHTML += '<h4>電気契約の選択</h4>';
        if (formData.utilityCompany) {
            summaryHTML += `<div class="summary-item"><strong>電力会社</strong><span>${formData.utilityCompany}</span></div>`;
        }
        if (formData.contractPlan) {
            summaryHTML += `<div class="summary-item"><strong>契約プラン</strong><span>${formData.contractPlan}</span></div>`;
        }
        if (formData.usagePattern) {
            summaryHTML += `<div class="summary-item"><strong>電気使用形態</strong><span>${formData.usagePattern}</span></div>`;
        }
        
        // 月別データの平均値を計算して表示
        const monthlyData = calculateMonthlyAverages(formData);
        if (monthlyData) {
            summaryHTML += `<div class="summary-item"><strong>月平均使用量</strong><span>${monthlyData.averageUsage} kWh</span></div>`;
            summaryHTML += `<div class="summary-item"><strong>月平均電気料金</strong><span>${monthlyData.averageBill} 円</span></div>`;
            summaryHTML += `<div class="summary-item"><strong>年間推定使用量</strong><span>${monthlyData.yearlyUsage} kWh</span></div>`;
            summaryHTML += `<div class="summary-item"><strong>年間推定電気料金</strong><span>${monthlyData.yearlyBill} 円</span></div>`;
        }
        
        summaryHTML += '</div>';

        // ステップ3: 太陽電池の選択
        summaryHTML += '<div class="summary-section">';
        summaryHTML += '<h4>太陽電池の選択</h4>';
        if (formData.moduleModel) {
            summaryHTML += `<div class="summary-item"><strong>モジュール型式</strong><span>${formData.moduleModel}</span></div>`;
        }
        if (formData.moduleQuantity) {
            summaryHTML += `<div class="summary-item"><strong>枚数</strong><span>${formData.moduleQuantity}枚</span></div>`;
        }
        if (formData.installationFace) {
            summaryHTML += `<div class="summary-item"><strong>設置面</strong><span>${formData.installationFace}</span></div>`;
        }
        if (formData.roofAngle) {
            summaryHTML += `<div class="summary-item"><strong>屋根の傾斜角度</strong><span>${formData.roofAngle}</span></div>`;
        }
        summaryHTML += '</div>';

        // ステップ4: 周辺機器の選択
        summaryHTML += '<div class="summary-section">';
        summaryHTML += '<h4>周辺機器の選択</h4>';
        
        // パワーコンディショナ1の情報
        if (formData.inverterModel) {
            summaryHTML += `<div class="summary-item"><strong>パワーコンディショナ1 型式</strong><span>${formData.inverterModel}</span></div>`;
        }
        if (formData.inverterQuantity) {
            summaryHTML += `<div class="summary-item"><strong>パワーコンディショナ1 台数</strong><span>${formData.inverterQuantity}台</span></div>`;
        }
        if (formData.stringConfiguration) {
            const config = formData.stringConfiguration;
            summaryHTML += `<div class="summary-item"><strong>ストリング構成1</strong><span>${config.series}直列 × ${config.parallel}並列</span></div>`;
        }
        
        // パワーコンディショナ2の情報（存在する場合）
        if (formData.inverterModel2) {
            summaryHTML += `<div class="summary-item"><strong>パワーコンディショナ2 型式</strong><span>${formData.inverterModel2}</span></div>`;
        }
        if (formData.inverterQuantity2) {
            summaryHTML += `<div class="summary-item"><strong>パワーコンディショナ2 台数</strong><span>${formData.inverterQuantity2}台</span></div>`;
        }
        if (formData.stringConfiguration2) {
            const config2 = formData.stringConfiguration2;
            summaryHTML += `<div class="summary-item"><strong>ストリング構成2</strong><span>${config2.series}直列 × ${config2.parallel}並列</span></div>`;
        }
        
        summaryHTML += '</div>';

        // ステップ5: 蓄電池の選択
        summaryHTML += '<div class="summary-section">';
        summaryHTML += '<h4>蓄電池の選択</h4>';
        if (formData.batteryModel) {
            if (formData.batteryModel === 'なし') {
                summaryHTML += `<div class="summary-item"><strong>蓄電池</strong><span>設置しない</span></div>`;
            } else {
                summaryHTML += `<div class="summary-item"><strong>蓄電池型式</strong><span>${formData.batteryModel}</span></div>`;
            }
        } else {
            summaryHTML += `<div class="summary-item"><strong>蓄電池</strong><span>設置しない</span></div>`;
        }
        summaryHTML += '</div>';

        summaryHTML += '</div>';

        summaryContent.innerHTML = summaryHTML;
        console.log('入力内容の確認を表示しました');

    } catch (error) {
        console.error('入力内容の確認表示エラー:', error);
        summaryContent.innerHTML = '<p style="color: red;">入力データの読み込みに失敗しました。</p>';
    }
}

// 都道府県データを読み込む関数
function loadPrefectureData() {
    return fetch('/static/nedo_locations_master.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            prefectures = data.prefectures || [];
            return data;
        })
        .catch(error => {
            console.error('都道府県データの読み込みに失敗しました:', error);
            // フォールバック用の都道府県リスト
            prefectures = ['茨城県','栃木県','群馬県','埼玉県','千葉県','東京都','神奈川県','新潟県','富山県','石川県','福井県','山梨県','長野県','岐阜県','静岡県','愛知県','三重県','滋賀県','京都府','大阪府','兵庫県','奈良県','和歌山県','鳥取県','島根県','岡山県','広島県','山口県','徳島県','香川県','愛媛県','高知県','福岡県','佐賀県','長崎県','熊本県','大分県','宮崎県','鹿児島県'];
        });
}

// モジュールデータを読み込む関数
function loadModuleData() {
    return fetch('/static/module_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            moduleData = data.modules || [];
            selectedModuleData = null; // モジュールを選択していない状態に戻す
            
            // モジュール型式のドロップダウンを更新
            const moduleModelSelect = document.getElementById('module-model');
            if (moduleModelSelect) {
                populateSelect('module-model', moduleData.map(m => m.model), '型式を選択');
                
                // 復元されたデータがある場合は値を設定
                if (formData.moduleModel) {
                    moduleModelSelect.value = formData.moduleModel;
                    moduleModelSelect.dispatchEvent(new Event('change'));
                }
            }
            

        })
        .catch(error => {
            console.error('モジュールデータの読み込みに失敗しました:', error);
            moduleData = []; // エラー時は空にする
            populateSelect('module-model', [], '型式を選択');
        });
}

// 電気使用形態データを読み込む関数
function loadUsagePatternData() {
    return fetch('/static/usage_patterns.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            usagePatternData = data;
            return data;
        })
        .catch(error => {
            console.error('電気使用形態データの読み込みに失敗しました:', error);
            usagePatternData = {}; // エラー時は空にする
        });
}

// 屋根の傾斜角度データを読み込む関数
function loadRoofAngleData() {
    return fetch('/static/roof_angles.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            roofAngleData = data.angles || [];
            
            // 屋根の傾斜角度のドロップダウンを更新
            const roofAngleSelect = document.getElementById('roof-angle');
            if (roofAngleSelect) {
                populateSelect('roof-angle', roofAngleData.map(angle => `${angle}度`), '傾斜角度を選択');
                
                // 復元されたデータがある場合は値を設定
                if (formData.roofAngle) {
                    roofAngleSelect.value = formData.roofAngle;
                }
            }
        })
        .catch(error => {
            console.error('屋根の傾斜角度データの読み込みに失敗しました:', error);
            roofAngleData = []; // エラー時は空にする
            populateSelect('roof-angle', [], '傾斜角度を選択');
        });
}

// インバータデータの読み込み
function loadInverterData() {
    return fetch('/static/inverter_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            inverterData = data.inverters || [];
            
            // インバータ型式のドロップダウンを更新
            const inverterModelSelect = document.getElementById('inverter-model');
            if (inverterModelSelect) {
                const modelNames = inverterData.map(inverter => inverter.model_name);
                populateSelect('inverter-model', modelNames, '型式を選択');
            }
        })
        .catch(error => {
            console.error('インバータデータの読み込みに失敗しました:', error);
            inverterData = []; // エラー時は空にする
            populateSelect('inverter-model', [], '型式を選択');
        });
}

// 蓄電池データを読み込む関数
function loadBatteryData() {
    console.log('蓄電池データの読み込みを開始します');
    return fetch('/static/battery_data.json')
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            return response.json();
        })
        .then(data => {
            batteryData = data.batteries || [];
            console.log('蓄電池データを読み込みました:', batteryData);
            
            // 蓄電池型式のドロップダウンを更新
            const batteryModelSelect = document.getElementById('battery-model');
            if (batteryModelSelect) {
                const batteryOptions = ['なし'].concat(batteryData.map(battery => battery.model_name));
                console.log('蓄電池選択肢を生成しました:', batteryOptions);
                populateSelect('battery-model', batteryOptions, '蓄電池を選択');
                
                // 復元されたデータがある場合は値を設定
                if (formData.batteryModel) {
                    batteryModelSelect.value = formData.batteryModel;
                    console.log('蓄電池の復元値を設定しました:', formData.batteryModel);
                }
            } else {
                console.warn('battery-model要素が見つかりません');
            }
        })
        .catch(error => {
            console.error('蓄電池データの読み込みに失敗しました:', error);
            batteryData = []; // エラー時は空にする
            populateSelect('battery-model', ['なし'], '蓄電池を選択');
        });
}

// ドロップダウンの初期化
function initializeDropdowns() {
    // 都道府県（JSONファイルから読み込み）
    populateSelect('prefecture', prefectures, '都道府県データを読み込み中...');
    // 電力会社
    populateSelect('utility-company', utilityCompanies, '電力会社を選択');
    // 契約プラン（初期状態は空）
    populateSelect('contract-plan', [], '電力会社を選択してください');
    // モジュール型式
    populateSelect('module-model', [], '型式を選択');
    // モジュール枚数はinput要素なので初期化不要
    populateSelect('inverter-model', [], '型式を選択');
    populateSelect('inverter-quantity', inverterQuantities, '台数を選択');
    populateSelect('battery-model', ['なし'], '蓄電池を選択');
}

document.addEventListener('DOMContentLoaded', () => {
    
    // 都道府県データを読み込んでからドロップダウンを初期化
    loadPrefectureData()
        .then(() => {
            // 都道府県プルダウンを更新
            populateSelect('prefecture', prefectures, '都道府県を選択');
        })
        .catch(() => {
            // エラー時も都道府県プルダウンを更新
            populateSelect('prefecture', prefectures, '都道府県を選択');
        })
        .finally(() => {
            // その他のドロップダウンを初期化
            populateSelect('utility-company', utilityCompanies, '電力会社を選択');
            populateSelect('contract-plan', [], '電力会社を選択してください');
            populateSelect('module-model', [], '型式を選択');
            // モジュール枚数はinput要素なので初期化不要
            populateSelect('inverter-model', [], '型式を選択');
            populateSelect('inverter-quantity', inverterQuantities, '台数を選択');
            populateSelect('battery-model', ['なし'], '蓄電池を選択');
        });
    
    // モジュールデータを読み込む
    loadModuleData();

    // 電気使用形態データを読み込む
    loadUsagePatternData();

    // 屋根の傾斜角度データを読み込む
    loadRoofAngleData();
    
    // インバータデータを読み込む
    loadInverterData();
    
    // データ読み込み後にローカルストレージからフォームデータを復元
    Promise.all([
        loadModuleData(),
        loadUsagePatternData(),
        loadRoofAngleData(),
        loadInverterData(),
        loadBatteryData()
    ]).then(() => {
        console.log('すべてのデータ読み込みが完了しました');
        restoreFormData();
    }).catch((error) => {
        console.error('データ読み込み中にエラーが発生しました:', error);
        // エラーが発生しても復元を試行
        restoreFormData();
    });
    
    // 地点は都道府県選択まで非アクティブ
    const locationSelect = document.getElementById('location-select');
    if (locationSelect) {
        locationSelect.innerHTML = '';
        locationSelect.disabled = true;
    }

    // 契約プランは電力会社選択まで非アクティブ
    const contractPlanSelect = document.getElementById('contract-plan');
    if (contractPlanSelect) {
        contractPlanSelect.disabled = true;
    }

    // 電気使用形態は契約プラン選択まで非アクティブ
    const usagePatternSelect = document.getElementById('usage-pattern');
    if (usagePatternSelect) {
        usagePatternSelect.disabled = true;
    }

    // 都道府県選択イベントリスナー
    const prefectureSelect = document.getElementById('prefecture');
    if (prefectureSelect) {
        prefectureSelect.addEventListener('change', function() {
            const selectedPref = this.value;
            
            // エラー表示をクリア
            clearStep1Errors();
            
            // 地点ドロップダウンをクリア
            if (locationSelect) {
                locationSelect.innerHTML = '';
                locationSelect.disabled = true;
            }
            
            // 都道府県が選択されていない場合
            if (!selectedPref) {
                if (locationSelect) {
                    const placeholder = document.createElement('option');
                    placeholder.value = '';
                    placeholder.textContent = '都道府県を選択してください';
                    placeholder.disabled = true;
                    placeholder.selected = true;
                    locationSelect.appendChild(placeholder);
                }
                return;
            }
            
            // ローディング表示
            if (locationSelect) {
                const loadingOption = document.createElement('option');
                loadingOption.value = '';
                loadingOption.textContent = '地点データを読み込み中...';
                loadingOption.disabled = true;
                loadingOption.selected = true;
                locationSelect.appendChild(loadingOption);
            }
            
            // fetchを使用してnedo_locations_master.jsonファイルを非同期で読み込み
            fetch('/static/nedo_locations_master.json')
                .then(response => {
                    if (!response.ok) {
                        throw new Error(`HTTP error! status: ${response.status}`);
                    }
                    return response.json();
                })
                .then(data => {
                    // 地点ドロップダウンをクリア
                    if (locationSelect) {
                        locationSelect.innerHTML = '';
                    }
                    
                    // 選択された都道府県名に合致する地点名のリストを抽出
                    const locations = data.locations[selectedPref] || [];
                    
                    if (locations.length > 0 && locationSelect) {
                        // プレースホルダーオプションを追加
                        const placeholder = document.createElement('option');
                        placeholder.value = '';
                        placeholder.textContent = '地点を選択';
                        placeholder.disabled = true;
                        placeholder.selected = true;
                        locationSelect.appendChild(placeholder);
                        
                        // 抽出した地点名のリストを地点選択プルダウンの選択肢として動的に生成・表示
                        locations.forEach(locationName => {
                            const option = document.createElement('option');
                            option.value = locationName;
                            option.textContent = locationName;
                            locationSelect.appendChild(option);
                        });
                        
                        // 地点プルダウンを有効化
                        locationSelect.disabled = false;
                    } else if (locationSelect) {
                        // 地点が見つからない場合
                        const noDataOption = document.createElement('option');
                        noDataOption.value = '';
                        noDataOption.textContent = 'この都道府県の地点データが見つかりません';
                        noDataOption.disabled = true;
                        noDataOption.selected = true;
                        locationSelect.appendChild(noDataOption);
                    }
                })
                .catch(error => {
                    console.error('地点データの読み込みに失敗しました:', error);
                    
                    // 地点ドロップダウンをクリア
                    if (locationSelect) {
                        locationSelect.innerHTML = '';
                        
                        // エラーメッセージを表示
                        const errorOption = document.createElement('option');
                        errorOption.value = '';
                        errorOption.textContent = '地点データの読み込みに失敗しました';
                        errorOption.disabled = true;
                        errorOption.selected = true;
                        locationSelect.appendChild(errorOption);
                    }
                });
        });
        
        // 地点選択イベントリスナーも追加
        if (locationSelect) {
            locationSelect.addEventListener('change', function() {
                // エラー表示をクリア
                clearStep1Errors();
            });
        }
    }

    // 電力会社選択時のイベントリスナー
    const utilityCompanySelect = document.getElementById('utility-company');
    if (utilityCompanySelect) {
        utilityCompanySelect.addEventListener('change', function() {
            const selectedUtility = this.value;
            
            // エラー表示をクリア
            clearStep2Errors();
            
            // 契約プランドロップダウンをクリア
            if (contractPlanSelect) {
                contractPlanSelect.innerHTML = '';
                contractPlanSelect.disabled = true;
            }

            // 電気使用形態ドロップダウンをクリア
            if (usagePatternSelect) {
                populateSelect('usage-pattern', Object.keys(usagePatternData), '電気使用形態を選択');
                usagePatternSelect.disabled = true;
            }
            // モジュール型式ドロップダウンをクリア
            if (document.getElementById('module-model')) {
                populateSelect('module-model', [], '型式を選択');
            }
            // モジュール枚数はinput要素なので初期化不要
            if (document.getElementById('inverter-model')) {
                populateSelect('inverter-model', inverterData.map(inverter => inverter.model_name), '型式を選択');
            }
            if (document.getElementById('inverter-quantity')) {
                populateSelect('inverter-quantity', inverterQuantities, '台数を選択');
            }
            if (document.getElementById('battery-model')) {
                populateSelect('battery-model', ['なし'], '蓄電池を選択');
            }

            if (selectedUtility && utilityCompanyFiles[selectedUtility]) {
                // JSONファイルからプラン情報を取得
                fetch(`/static/${utilityCompanyFiles[selectedUtility]}`)
                    .then(response => response.json())
                    .then(data => {
                        const plans = data.active_plans?.plans || [];
                        const planNames = plans.map(plan => plan.plan_name);
                        
                        if (planNames.length > 0 && contractPlanSelect) {
                            const placeholder = document.createElement('option');
                            placeholder.value = '';
                            placeholder.textContent = '契約プランを選択';
                            placeholder.disabled = true;
                            placeholder.selected = true;
                            contractPlanSelect.appendChild(placeholder);
                            planNames.forEach(planName => {
                                const opt = document.createElement('option');
                                opt.value = planName;
                                opt.textContent = planName;
                                contractPlanSelect.appendChild(opt);
                            });
                            contractPlanSelect.disabled = false;
                        } else if (contractPlanSelect) {
                            // プランが見つからない場合
                            const placeholder = document.createElement('option');
                            placeholder.value = '';
                            placeholder.textContent = 'プランが見つかりません';
                            placeholder.disabled = true;
                            placeholder.selected = true;
                            contractPlanSelect.appendChild(placeholder);
                        }
                    })
                    .catch(error => {
                        console.error('プラン情報の読み込みに失敗しました:', error);
                        if (contractPlanSelect) {
                            const placeholder = document.createElement('option');
                            placeholder.value = '';
                            placeholder.textContent = 'プラン情報の読み込みに失敗しました';
                            placeholder.disabled = true;
                            placeholder.selected = true;
                            contractPlanSelect.appendChild(placeholder);
                        }
                    });

                // モジュールデータを読み込む
                loadModuleData();
            }
        });
        
        // 契約プラン選択時のイベントリスナーも追加
        if (contractPlanSelect) {
            contractPlanSelect.addEventListener('change', function() {
                const selectedPlan = this.value;
                
                // エラー表示をクリア
                clearStep2Errors();
                
                // 電気使用形態を有効化
                if (usagePatternSelect) {
                    usagePatternSelect.disabled = false;
                }
            });
        }
    }
    
    // 電気使用形態選択時のイベントリスナー
    if (usagePatternSelect) {
        usagePatternSelect.addEventListener('change', function() {
            const selectedUsagePattern = this.value;
            
            // エラー表示をクリア
            clearStep2Errors();

            if (selectedUsagePattern && usagePatternData[selectedUsagePattern]) {
                // 選択された電気使用形態の詳細データを取得
                // ここでは、例として 'usage_pattern' キーにデータを保存
                formData.usagePattern = selectedUsagePattern;
                formData.usagePatternData = usagePatternData[selectedUsagePattern]; // 詳細データも保存
            } else {
                formData.usagePattern = '';
                delete formData.usagePatternData;
            }
        });
    }
    
    // 蓄電池型式選択時のイベントリスナー
    const batteryModelSelect = document.getElementById('battery-model');
    if (batteryModelSelect) {
        console.log('蓄電池選択イベントリスナーを設定しました');
        batteryModelSelect.addEventListener('change', function() {
            const selectedBatteryModel = this.value;
            console.log('蓄電池が選択されました:', selectedBatteryModel);
            
            if (selectedBatteryModel && selectedBatteryModel !== 'なし') {
                // 選択された蓄電池の詳細データを取得
                const selectedBatteryData = batteryData.find(battery => battery.model_name === selectedBatteryModel);
                
                if (selectedBatteryData) {
                    formData.batteryModel = selectedBatteryModel;
                    formData.batteryData = selectedBatteryData; // 詳細データも保存
                    console.log('選択された蓄電池:', selectedBatteryData);
                    
                    // 蓄電池詳細情報を表示
                    displayBatteryDetails(selectedBatteryData);
                } else {
                    console.warn('選択された蓄電池の詳細データが見つかりません:', selectedBatteryModel);
                    hideBatteryDetails();
                }
            } else {
                // 「なし」が選択された場合
                formData.batteryModel = 'なし';
                delete formData.batteryData;
                console.log('蓄電池なしが選択されました');
                hideBatteryDetails();
            }
        });
    } else {
        console.warn('battery-model要素が見つからないため、イベントリスナーを設定できません');
    }
    
    // モジュール型式選択時のイベントリスナー
    const moduleModelSelect = document.getElementById('module-model');
    if (moduleModelSelect) {
        moduleModelSelect.addEventListener('change', function() {
            const selectedModel = this.value;
            
            // エラー表示をクリア
            clearStep3Errors();
            
            if (selectedModel && moduleData.length > 0) {
                // 選択されたモジュールの詳細データを取得
                selectedModuleData = moduleData.find(module => module.model === selectedModel);
                
                if (selectedModuleData) {
                    console.log('選択されたモジュール:', selectedModuleData);
                    
                    // 後続の計算で使用するためにフォームデータに保存
                    formData.selectedModuleData = selectedModuleData;
                }
            } else {
                selectedModuleData = null;
                delete formData.selectedModuleData;
            }
        });
    }
    
    // 枚数入力時のイベントリスナー
    const moduleQuantityInput = document.getElementById('module-quantity');
    if (moduleQuantityInput) {
        moduleQuantityInput.addEventListener('input', function() {
            // エラー表示をクリア
            clearStep3Errors();
            
            // 入力値をフォームデータに保存
            if (this.value) {
                formData.moduleQuantity = this.value;
                console.log('モジュール枚数が保存されました:', this.value);
            }
        });
    }
    
    // 設置面選択時のエラー表示クリア
    const installationFaceSelect = document.getElementById('installation-face');
    if (installationFaceSelect) {
        installationFaceSelect.addEventListener('change', function() {
            // エラー表示をクリア
            clearStep3Errors();
        });
    }
    
    // 屋根の傾斜角度選択時のイベントリスナー
    const roofAngleSelect = document.getElementById('roof-angle');
    if (roofAngleSelect) {
        roofAngleSelect.addEventListener('change', function() {
            const selectedAngle = this.value;
            
            // エラー表示をクリア
            clearStep3Errors();
            
            if (selectedAngle) {
                // 選択された角度を数値として抽出（"30度" → 30）
                const angleValue = parseInt(selectedAngle.replace('度', ''));
                
                if (!isNaN(angleValue)) {
                    console.log('選択された屋根の傾斜角度:', angleValue);
                    
                    // フォームデータに保存
                    formData.roofAngle = selectedAngle;
                    formData.roofAngleValue = angleValue;
                }
            } else {
                delete formData.roofAngle;
                delete formData.roofAngleValue;
            }
        });
    }
    
    // 月別データ入力時のエラー表示クリア
    const monthlyInputs = document.querySelectorAll('input[name^="usage_"], input[name^="bill_"]');
    monthlyInputs.forEach(input => {
        input.addEventListener('input', function() {
            // エラー表示をクリア
            clearStep2Errors();
        });
    });
    
    // ステップ4の処理
    const currentPage = getCurrentPageNumber();
    if (currentPage === 4) {
        const totalModulesDisplay = document.getElementById('total-modules-display');
        if (totalModulesDisplay) {
            const step3ModuleQuantity = formData.moduleQuantity || 0;
            console.log('ステップ4: モジュール合計枚数:', step3ModuleQuantity);
            totalModulesDisplay.textContent = `${step3ModuleQuantity}枚`;
        }
        
        // ストリング構成入力時の検証イベントリスナー
        const seriesInput = document.getElementById('series-input');
        const parallelInput = document.getElementById('parallel-input');
        const validationMessage = document.getElementById('string-config-validation');
        
        if (seriesInput && parallelInput) {
            const validateStringConfig = () => {
                if (seriesInput.value && parallelInput.value) {
                    const series = parseInt(seriesInput.value);
                    const parallel = parseInt(parallelInput.value);
                    const totalModules = series * parallel;
                    // フォームデータからモジュール枚数を取得
                    const step3ModuleQuantity = formData.moduleQuantity || 0;
                    
                    // デバッグログを追加
                    console.log('ストリング構成検証:');
                    console.log('  series:', series, 'type:', typeof series);
                    console.log('  parallel:', parallel, 'type:', typeof parallel);
                    console.log('  totalModules:', totalModules, 'type:', typeof totalModules);
                    console.log('  step3ModuleQuantity:', step3ModuleQuantity, 'type:', typeof step3ModuleQuantity);
                    console.log('  比較結果:', totalModules !== step3ModuleQuantity);
                    
                    // 型を統一して比較
                    const step3ModuleQuantityNum = parseInt(step3ModuleQuantity);
                    
                    if (totalModules !== step3ModuleQuantityNum) {
                        if (validationMessage) {
                            validationMessage.textContent = `ストリング構成が合計枚数と一致しません。直列枚数(${series}) × 並列数(${parallel}) = ${totalModules}枚、選択されたモジュール合計枚数: ${step3ModuleQuantityNum}枚`;
                            validationMessage.style.display = 'block';
                            validationMessage.style.color = '#d32f2f';
                        }
                    } else {
                        if (validationMessage) {
                            validationMessage.style.display = 'none';
                        }
                    }
                } else {
                    if (validationMessage) {
                        validationMessage.style.display = 'none';
                    }
                }
            };
            
            seriesInput.addEventListener('input', validateStringConfig);
            parallelInput.addEventListener('input', validateStringConfig);
        }
    }
    
    // 最後のステップ（ステップ6）で入力内容確認とシミュレーションを実行
    if (currentPage === 6) {
        displayInputSummary();
        runSimulation();
    }
    
    // 自動計算ボタンイベントリスナー
    const autoCalculateBtn = document.getElementById('auto-calculate-btn');
    if (autoCalculateBtn) {
        autoCalculateBtn.addEventListener('click', autoCalculateMonthlyData);
    }
    
    // 入力内容確認セクションの折りたたみ機能を初期化
    initializeSummaryToggle();
});

// パワーコンディショナ追加機能
function addInverterForm() {
    const inverterGroup2 = document.getElementById('inverter-group-2');
    const addButton = document.getElementById('add-inverter-btn');
    
    if (inverterGroup2 && addButton) {
        // 2セット目の入力欄を表示
        inverterGroup2.style.display = 'block';
        
        // 追加ボタンを非表示にして複数追加を防ぐ
        addButton.style.display = 'none';
        
        // 2セット目のドロップダウンを初期化
        initializeSecondInverterDropdowns();
        
        console.log('パワーコンディショナ2セット目を追加しました');
    }
}

// パワーコンディショナ削除機能
function removeInverterForm() {
    const inverterGroup2 = document.getElementById('inverter-group-2');
    const addButton = document.getElementById('add-inverter-btn');
    
    if (inverterGroup2 && addButton) {
        // 2セット目の入力欄を非表示
        inverterGroup2.style.display = 'none';
        
        // 追加ボタンを再表示
        addButton.style.display = 'block';
        
        // 2セット目の入力値をクリア
        clearSecondInverterInputs();
        
        // フォームデータから2セット目のデータを削除
        delete formData.inverterModel2;
        delete formData.inverterQuantity2;
        delete formData.seriesInput2;
        delete formData.parallelInput2;
        
        console.log('パワーコンディショナ2セット目を削除しました');
    }
}

// 2セット目の入力値をクリア
function clearSecondInverterInputs() {
    const inverterModel2 = document.getElementById('inverter-model2');
    const inverterQuantity2 = document.getElementById('inverter-quantity2');
    const seriesInput2 = document.getElementById('series-input2');
    const parallelInput2 = document.getElementById('parallel-input2');
    
    if (inverterModel2) inverterModel2.value = '';
    if (inverterQuantity2) inverterQuantity2.value = '';
    if (seriesInput2) seriesInput2.value = '';
    if (parallelInput2) parallelInput2.value = '';
}

// 2セット目のパワーコンディショナドロップダウン初期化
function initializeSecondInverterDropdowns() {
    // インバータ型式ドロップダウン
    const inverterModel2Select = document.getElementById('inverter-model2');
    if (inverterModel2Select && inverterData.length > 0) {
        inverterModel2Select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = 'パワーコンディショナ型式を選択してください';
        placeholder.disabled = true;
        placeholder.selected = true;
        inverterModel2Select.appendChild(placeholder);
        
        inverterData.forEach(inverter => {
            const option = document.createElement('option');
            option.value = inverter.model;
            option.textContent = `${inverter.model} (${inverter.rated_output_power}kW)`;
            inverterModel2Select.appendChild(option);
        });
    }
    
    // インバータ台数ドロップダウン
    const inverterQuantity2Select = document.getElementById('inverter-quantity2');
    if (inverterQuantity2Select) {
        inverterQuantity2Select.innerHTML = '';
        const placeholder = document.createElement('option');
        placeholder.value = '';
        placeholder.textContent = '台数を選択してください';
        placeholder.disabled = true;
        placeholder.selected = true;
        inverterQuantity2Select.appendChild(placeholder);
        
        inverterQuantities.forEach(quantity => {
            const option = document.createElement('option');
            option.value = quantity;
            option.textContent = `${quantity}台`;
            inverterQuantity2Select.appendChild(option);
        });
    }
}

// 入力内容確認セクションの折りたたみ機能
function initializeSummaryToggle() {
    const toggleBtn = document.getElementById('toggle-summary-btn');
    const summaryBody = document.getElementById('input-summary-content');
    const toggleIcon = toggleBtn?.querySelector('.toggle-icon');
    const toggleText = toggleBtn?.querySelector('.toggle-text');
    
    if (toggleBtn && summaryBody) {
        // 初期状態を展開状態に設定
        summaryBody.classList.add('expanded');
        
        toggleBtn.addEventListener('click', function() {
            const isExpanded = summaryBody.classList.contains('expanded');
            
            if (isExpanded) {
                // 非表示にする
                summaryBody.classList.remove('expanded');
                summaryBody.classList.add('collapsed');
                if (toggleIcon) toggleIcon.textContent = '▶';
                if (toggleText) toggleText.textContent = '表示';
            } else {
                // 表示する
                summaryBody.classList.remove('collapsed');
                summaryBody.classList.add('expanded');
                if (toggleIcon) toggleIcon.textContent = '▼';
                if (toggleText) toggleText.textContent = '非表示';
            }
        });
    }
}

// 1日の電力の流れ複合グラフを描画する関数
function drawPowerFlowChart(hourlyGeneration, hourlySelfConsumption, hourlySurplusPower) {
    const canvas = document.getElementById('powerFlowChart');
    if (!canvas) {
        console.warn('電力の流れグラフのcanvas要素が見つかりません');
        return;
    }
    
    // 既存のグラフがある場合は破棄
    if (window.powerFlowChart && typeof window.powerFlowChart.destroy === 'function') {
        window.powerFlowChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // 時間ラベルの配列
    const hourLabels = ['0時', '1時', '2時', '3時', '4時', '5時', '6時', '7時', '8時', '9時', '10時', '11時', 
                       '12時', '13時', '14時', '15時', '16時', '17時', '18時', '19時', '20時', '21時', '22時', '23時'];
    
    // Chart.jsでグラフを作成
    try {
        window.powerFlowChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hourLabels,
                datasets: [
                    {
                        label: '発電量 (kWh)',
                        data: hourlyGeneration,
                        backgroundColor: 'rgba(33, 150, 243, 0.2)',
                        borderColor: 'rgba(33, 150, 243, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(33, 150, 243, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    },
                    {
                        label: '自家消費量 (kWh)',
                        data: hourlySelfConsumption,
                        backgroundColor: 'rgba(76, 175, 80, 0.2)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(76, 175, 80, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    },
                    {
                        label: '売電量 (kWh)',
                        data: hourlySurplusPower,
                        backgroundColor: 'rgba(255, 152, 0, 0.2)',
                        borderColor: 'rgba(255, 152, 0, 1)',
                        borderWidth: 3,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(255, 152, 0, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y'
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: '1日の電力の流れ（発電量・自家消費量・売電量）',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            },
                            color: '#2c3e50',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(3);
                                return `${label}: ${value} kWh`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '時間',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '電力量 (kWh)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50',
                            callback: function(value) {
                                return value.toFixed(2) + ' kWh';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('1日の電力の流れ複合グラフを描画しました');
        
    } catch (error) {
        console.error('1日の電力の流れ複合グラフ描画エラー:', error);
    }
}

// 季節別の1日の電力の流れグラフを描画する関数


// 蓄電池の充放電パターングラフを描画する関数
function drawBatteryPatternChart(batteryPattern) {
    const canvas = document.getElementById('batteryPatternChart');
    if (!canvas) {
        console.warn('蓄電池パターングラフのcanvas要素が見つかりません');
        return;
    }
    
    // 蓄電池セクションを表示
    const batterySection = document.getElementById('batteryPatternSection');
    if (batterySection) {
        batterySection.style.display = 'block';
    }
    
    // 既存のグラフがある場合は破棄
    if (window.batteryPatternChart && typeof window.batteryPatternChart.destroy === 'function') {
        window.batteryPatternChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // 時間ラベルの配列
    const hourLabels = ['0時', '1時', '2時', '3時', '4時', '5時', '6時', '7時', '8時', '9時', '10時', '11時', 
                       '12時', '13時', '14時', '15時', '16時', '17時', '18時', '19時', '20時', '21時', '22時', '23時'];
    
    // Chart.jsでグラフを作成
    try {
        window.batteryPatternChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hourLabels,
                datasets: [
                    {
                        label: '充電量 (kWh)',
                        data: batteryPattern.daily_charge_pattern,
                        backgroundColor: 'rgba(76, 175, 80, 0.1)',
                        borderColor: 'rgba(76, 175, 80, 1)',
                        borderWidth: 3,
                        fill: '+1',
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(76, 175, 80, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: '放電量 (kWh)',
                        data: batteryPattern.daily_discharge_pattern,
                        backgroundColor: 'rgba(244, 67, 54, 0.1)',
                        borderColor: 'rgba(244, 67, 54, 1)',
                        borderWidth: 3,
                        fill: '+1',
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(244, 67, 54, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 4,
                        pointHoverRadius: 6,
                        yAxisID: 'y',
                        order: 2
                    },
                    {
                        label: '蓄電池残量 (kWh)',
                        data: batteryPattern.daily_battery_level,
                        backgroundColor: 'rgba(156, 39, 176, 0.2)',
                        borderColor: 'rgba(156, 39, 176, 1)',
                        borderWidth: 4,
                        fill: false,
                        tension: 0.4,
                        pointBackgroundColor: 'rgba(156, 39, 176, 1)',
                        pointBorderColor: '#fff',
                        pointBorderWidth: 2,
                        pointRadius: 5,
                        pointHoverRadius: 7,
                        yAxisID: 'y',
                        order: 1
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: `蓄電池の充放電パターン（容量: ${batteryPattern.battery_capacity}kWh）`,
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    },
                    subtitle: {
                        display: true,
                        text: `年間充電量: ${batteryPattern.annual_charge_total}kWh, 年間放電量: ${batteryPattern.annual_discharge_total}kWh`,
                        font: {
                            size: 12
                        },
                        color: '#7f8c8d'
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            },
                            color: '#2c3e50',
                            usePointStyle: true,
                            pointStyle: 'circle'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(3);
                                return `${label}: ${value} kWh`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '時間',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '電力量 (kWh)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50',
                            callback: function(value) {
                                return value.toFixed(2) + ' kWh';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('蓄電池の充放電パターングラフを描画しました');
        
    } catch (error) {
        console.error('蓄電池の充放電パターングラフ描画エラー:', error);
    }
}

// 蓄電池ありなしの比較グラフを描画する関数
function drawBatteryComparisonChart(batteryComparison) {
    const canvas = document.getElementById('batteryComparisonChart');
    if (!canvas) {
        console.warn('蓄電池比較グラフのcanvas要素が見つかりません');
        return;
    }
    
    // 蓄電池比較セクションを表示
    const batteryComparisonSection = document.getElementById('batteryComparisonSection');
    if (batteryComparisonSection) {
        batteryComparisonSection.style.display = 'block';
    }
    
    // 既存のグラフがある場合は破棄
    if (window.batteryComparisonChart && typeof window.batteryComparisonChart.destroy === 'function') {
        window.batteryComparisonChart.destroy();
    }
    
    const ctx = canvas.getContext('2d');
    
    // Chart.jsでグラフを作成
    try {
        window.batteryComparisonChart = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: ['自家消費量', '売電量'],
                datasets: [
                    {
                        label: '蓄電池なし',
                        data: [
                            batteryComparison.without_battery.annual_self_consumption,
                            batteryComparison.without_battery.annual_sell_electricity
                        ],
                        backgroundColor: 'rgba(52, 152, 219, 0.7)',
                        borderColor: 'rgba(52, 152, 219, 1)',
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false
                    },
                    {
                        label: '蓄電池あり',
                        data: [
                            batteryComparison.with_battery.annual_self_consumption,
                            batteryComparison.with_battery.annual_sell_electricity
                        ],
                        backgroundColor: 'rgba(46, 204, 113, 0.7)',
                        borderColor: 'rgba(46, 204, 113, 1)',
                        borderWidth: 2,
                        borderRadius: 4,
                        borderSkipped: false
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: {
                    mode: 'index',
                    intersect: false,
                },
                plugins: {
                    title: {
                        display: true,
                        text: '蓄電池ありなしの年間電力使用量比較',
                        font: {
                            size: 16,
                            weight: 'bold'
                        },
                        color: '#2c3e50'
                    },
                    subtitle: {
                        display: true,
                        text: `自家消費量増加: ${(batteryComparison.with_battery.annual_self_consumption - batteryComparison.without_battery.annual_self_consumption).toFixed(1)}kWh, 売電量減少: ${(batteryComparison.without_battery.annual_sell_electricity - batteryComparison.with_battery.annual_sell_electricity).toFixed(1)}kWh`,
                        font: {
                            size: 12
                        },
                        color: '#7f8c8d'
                    },
                    legend: {
                        display: true,
                        position: 'top',
                        labels: {
                            font: {
                                size: 12
                            },
                            color: '#2c3e50',
                            usePointStyle: true,
                            pointStyle: 'rect'
                        }
                    },
                    tooltip: {
                        backgroundColor: 'rgba(0, 0, 0, 0.8)',
                        titleColor: 'white',
                        bodyColor: 'white',
                        borderColor: 'rgba(255, 255, 255, 0.2)',
                        borderWidth: 1,
                        cornerRadius: 6,
                        displayColors: true,
                        callbacks: {
                            label: function(context) {
                                const label = context.dataset.label || '';
                                const value = context.parsed.y.toFixed(1);
                                return `${label}: ${value} kWh`;
                            }
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: '電力の種類',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50'
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    },
                    y: {
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: '電力量 (kWh)',
                            font: {
                                size: 14,
                                weight: 'bold'
                            },
                            color: '#2c3e50'
                        },
                        ticks: {
                            font: {
                                size: 11
                            },
                            color: '#2c3e50',
                            callback: function(value) {
                                return value.toFixed(0) + ' kWh';
                            }
                        },
                        grid: {
                            color: 'rgba(0, 0, 0, 0.1)',
                            drawBorder: false
                        }
                    }
                }
            }
        });
        
        console.log('蓄電池ありなしの比較グラフを描画しました');
        
    } catch (error) {
        console.error('蓄電池ありなしの比較グラフ描画エラー:', error);
    }
}

// 蓄電池詳細情報を表示する関数
function displayBatteryDetails(batteryPattern, batteryComparison) {
    const batteryDetailsSection = document.getElementById('batteryDetailsSection');
    const batteryDetailsContent = document.getElementById('batteryDetailsContent');
    
    if (!batteryDetailsSection || !batteryDetailsContent) {
        console.warn('蓄電池詳細情報セクションが見つかりません');
        return;
    }
    
    // 蓄電池詳細セクションを表示
    batteryDetailsSection.style.display = 'block';
    
    // 自家消費量と売電量の変化を計算
    const selfConsumptionIncrease = batteryComparison.with_battery.annual_self_consumption - batteryComparison.without_battery.annual_self_consumption;
    const sellElectricityDecrease = batteryComparison.without_battery.annual_sell_electricity - batteryComparison.with_battery.annual_sell_electricity;
    
    // 充放電効率を計算
    const chargeEfficiency = batteryPattern.annual_discharge_total / batteryPattern.annual_charge_total * 100;
    
    batteryDetailsContent.innerHTML = `
        <div class="battery-details-grid">
            <div class="battery-detail-card">
                <h4>蓄電池仕様</h4>
                <ul>
                    <li><strong>実効容量:</strong> ${batteryPattern.battery_capacity} kWh</li>
                    <li><strong>定格出力:</strong> ${batteryPattern.battery_power} kW</li>
                    <li><strong>充放電効率:</strong> ${(batteryPattern.charge_discharge_efficiency * 100).toFixed(1)}%</li>
                </ul>
            </div>
            
            <div class="battery-detail-card">
                <h4>年間充放電実績</h4>
                <ul>
                    <li><strong>年間充電量:</strong> ${batteryPattern.annual_charge_total} kWh</li>
                    <li><strong>年間放電量:</strong> ${batteryPattern.annual_discharge_total} kWh</li>
                    <li><strong>実効充放電効率:</strong> ${chargeEfficiency.toFixed(1)}%</li>
                </ul>
            </div>
            
            <div class="battery-detail-card">
                <h4>経済効果の変化</h4>
                <ul>
                    <li><strong>自家消費量増加:</strong> <span style="color: #27ae60;">+${selfConsumptionIncrease.toFixed(1)} kWh</span></li>
                    <li><strong>売電量減少:</strong> <span style="color: #e74c3c;">-${sellElectricityDecrease.toFixed(1)} kWh</span></li>
                    <li><strong>自家消費率向上:</strong> <span style="color: #27ae60;">+${((selfConsumptionIncrease / batteryComparison.without_battery.annual_self_consumption) * 100).toFixed(1)}%</span></li>
                </ul>
            </div>
            
            <div class="battery-detail-card">
                <h4>1日の充放電パターン</h4>
                <ul>
                    <li><strong>最大充電時間:</strong> ${getMaxChargeTime(batteryPattern.daily_charge_pattern)}</li>
                    <li><strong>最大放電時間:</strong> ${getMaxDischargeTime(batteryPattern.daily_discharge_pattern)}</li>
                    <li><strong>平均蓄電残量:</strong> ${(batteryPattern.daily_battery_level.reduce((a, b) => a + b, 0) / 24).toFixed(1)} kWh</li>
                </ul>
            </div>
        </div>
    `;
    
    console.log('蓄電池詳細情報を表示しました');
}

// 最大充電時間を取得する関数
function getMaxChargeTime(chargePattern) {
    const maxIndex = chargePattern.indexOf(Math.max(...chargePattern));
    return `${maxIndex}時`;
}

// 最大放電時間を取得する関数
function getMaxDischargeTime(dischargePattern) {
    const maxIndex = dischargePattern.indexOf(Math.max(...dischargePattern));
    return `${maxIndex}時`;
}

// 10年間の経済効果テーブルを表示する関数
function displayYearlyEconomicEffectsTable(yearlyBreakdown, total10YearEffect) {
    const tableBody = document.getElementById('yearlyEconomicEffectsTableBody');
    const totalElement = document.getElementById('total10YearEffect');
    
    if (!tableBody || !totalElement) {
        console.warn('10年間の経済効果テーブル要素が見つかりません');
        return;
    }
    
    // テーブルの内容をクリア
    tableBody.innerHTML = '';
    
    // 各年のデータをテーブルに追加
    yearlyBreakdown.forEach(yearData => {
        const row = document.createElement('tr');
        
        // 年次
        const yearCell = document.createElement('td');
        yearCell.className = 'year-cell';
        yearCell.textContent = `${yearData.year}年目`;
        
        // 売電単価
        const priceCell = document.createElement('td');
        priceCell.className = 'price-cell';
        priceCell.textContent = `${yearData.sell_price}円`;
        
        // 売電額
        const revenueCell = document.createElement('td');
        revenueCell.className = 'revenue-cell';
        revenueCell.textContent = `${yearData.sell_revenue.toLocaleString()}円`;
        
        // 自家消費量 (kWh)
        const consumptionCell = document.createElement('td');
        consumptionCell.className = 'consumption-cell';
        consumptionCell.textContent = `${yearData.self_consumption_kwh.toLocaleString()}kWh`;
        
        // 自家消費額
        const savingsCell = document.createElement('td');
        savingsCell.className = 'savings-cell';
        savingsCell.textContent = `${yearData.self_consumption_yen.toLocaleString()}円`;
        
        // 合計経済効果
        const totalCell = document.createElement('td');
        totalCell.className = 'total-cell';
        totalCell.textContent = `${yearData.total_effect.toLocaleString()}円`;
        
        // 累計経済効果
        const cumulativeCell = document.createElement('td');
        cumulativeCell.className = 'cumulative-cell';
        cumulativeCell.textContent = `${yearData.cumulative_total_effect.toLocaleString()}円`;
        
        // 行にセルを追加
        row.appendChild(yearCell);
        row.appendChild(priceCell);
        row.appendChild(revenueCell);
        row.appendChild(consumptionCell);
        row.appendChild(savingsCell);
        row.appendChild(totalCell);
        row.appendChild(cumulativeCell);
        
        // テーブルに行を追加
        tableBody.appendChild(row);
    });
    
    // 10年間の総経済効果を表示（合計経済効果の累計）
    totalElement.innerHTML = `
        <span style="font-size: 2em; font-weight: bold; color: white;">
            ${total10YearEffect.toLocaleString()}円
        </span>
        <br>
        <small style="color: #e8f5e8; font-size: 0.9em;">
            10年間の合計経済効果累計
        </small>
    `;
    
    console.log('10年間の経済効果テーブルを表示しました');
}

// 蓄電池詳細情報を表示する関数
function displayBatteryDetails(batteryData) {
    const detailsElement = document.getElementById('battery-details');
    if (!detailsElement) {
        console.warn('battery-details要素が見つかりません');
        return;
    }
    
    // 詳細情報を設定
    document.getElementById('selected-battery-model').textContent = batteryData.model_name || '';
    document.getElementById('selected-battery-capacity').textContent = batteryData.capacity_kwh ? `${batteryData.capacity_kwh}kWh` : '';
    document.getElementById('selected-battery-effective-capacity').textContent = batteryData.effective_capacity_kwh ? `${batteryData.effective_capacity_kwh}kWh` : '';
    document.getElementById('selected-battery-output').textContent = batteryData.rated_output_kw ? `${batteryData.rated_output_kw}kW` : '';
    document.getElementById('selected-battery-efficiency').textContent = batteryData.charge_discharge_efficiency_percent ? `${batteryData.charge_discharge_efficiency_percent}%` : '';
    document.getElementById('selected-battery-manufacturer').textContent = batteryData.manufacturer || '';
    
    // 詳細情報を表示
    detailsElement.style.display = 'block';
    
    console.log('蓄電池詳細情報を表示しました:', batteryData);
}

// 蓄電池詳細情報を非表示にする関数
function hideBatteryDetails() {
    const detailsElement = document.getElementById('battery-details');
    if (detailsElement) {
        detailsElement.style.display = 'none';
        console.log('蓄電池詳細情報を非表示にしました');
    }
}
 