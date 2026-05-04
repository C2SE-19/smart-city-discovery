const { resolveBridgeVisualCueRule, hasBridgeSignal, normalizeVisionNoAccent } = require('../server');

const CASES = [
    { name: 'Dragon bridge obvious', text: 'Cảnh chụp cầu rồng phun lửa vào ban đêm', expectContains: 'cầu rồng' },
    { name: 'Song Han rotate', text: 'Hình ảnh cầu sông Hàn đang xoay', expectContains: 'cầu sông hàn' },
    { name: 'Tran Thi Ly sail', text: 'Cầu Trần Thị Lý với dáng cánh buồm', expectContains: 'cầu trần thị lý' },
    { name: 'Golden bridge hands', text: 'Cầu vàng bàn tay nổi tiếng', expectContains: 'cầu vàng' },
    { name: 'Non-bridge', text: 'Công viên nước với cầu trượt và hồ bơi', expectContains: null }
];

function run() {
    console.log('Running bridge-vision-unit-test with', CASES.length, 'cases');

    for (const c of CASES) {
        const values = [c.text];
        const signal = hasBridgeSignal(values);
        const rule = resolveBridgeVisualCueRule(values);
        const detected = rule ? rule.canonical : null;
        console.log('---');
        console.log('Case:', c.name);
        console.log('Text:', c.text);
        console.log('hasBridgeSignal:', signal);
        console.log('detectedCanonical:', detected);
        console.log('expectedContains:', c.expectContains);
    }
}

run();
