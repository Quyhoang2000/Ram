// Lấy dữ liệu phản hồi
let body = $response.body;
if (!body) $done({});

let objc = JSON.parse(body);

// Tạo biến thời gian thực để chống quét lệch múi giờ
const now = Date.now();
const farFuture = 4092599349000; // Năm 2099

// 1. Ép xác thực thanh toán hợp lệ (Billing & Receipt)
const proStructure = {
    "status": "success",
    "is_pro": true,
    "is_vip": true,
    "valid": true,
    "type": "subscription",
    "store": "apple_app_store",
    "can_purchase": false,
    "auto_renewing": true,
    "order_number": "GPA.3312-8888-0000-1111", // Mã giả lập hóa đơn Apple
    "product_id": "com.capcut.pro.yearly", // Hoặc ID của Alight tùy app
    "purchase_date_ms": 1672531200000,
    "expires_date_ms": farFuture,
    "server_time": now
};

// 2. Tấn công vào các mục dữ liệu chính (Universal Patch)
if (objc.result) {
    objc.result = { ...objc.result, ...proStructure };
}

if (objc.data) {
    // Mở khóa cho Profile người dùng
    if (objc.data.user_info) {
        objc.data.user_info.is_vip = true;
        objc.data.user_info.vip_type = 1;
        objc.data.user_info.exp_time = farFuture / 1000;
    }
    // Mở khóa cho trạng thái VIP
    objc.data.is_vip = true;
    objc.data.vip_state = 1;
    objc.data.subscription = [{
        "status": "active",
        "product_id": "com.capcut.pro.yearly",
        "expire_time": farFuture / 1000
    }];
}

// 3. Xóa bỏ các cảnh báo lỗi nạp/quét (Warnings)
if (objc.warnings) objc.warnings = [];
if (objc.errors) delete objc.errors;

// Trả về kết quả đã được "phù phép"
$done({ body: JSON.stringify(objc) });