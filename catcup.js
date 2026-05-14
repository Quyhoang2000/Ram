/*
Script mở khóa CapCut Pro (Global & Việt Nam)
*/

// Lấy dữ liệu phản hồi từ máy chủ
let body = $response.body;
let obj = JSON.parse(body);

// Cấu trúc dữ liệu Pro giả lập
const vipInfo = {
  "is_vip": true,
  "vip_type": 1,
  "expire_time": 4092599349, // Năm 2099
  "start_time": 1683949349,
  "can_purchase_vip": false,
  "vip_status": 1
};

// 1. Xử lý thông tin người dùng (User Profile)
if (obj.data && obj.data.user_info) {
    obj.data.user_info.is_vip = true;
    obj.data.user_info.vip_info = vipInfo;
}

// 2. Xử lý trạng thái đăng ký (Subscription State)
if (obj.data && obj.data.subscription) {
    obj.data.subscription = [
        {
            "id": "capcut_pro_yearly",
            "status": "active",
            "expire_date": "2099-12-31"
        }
    ];
}

// 3. Xử lý các endpoint kiểm tra VIP chung
if (obj.data && obj.data.is_vip !== undefined) {
    obj.data.is_vip = true;
}

// Chuyển đối tượng JSON đã sửa lại thành dạng chuỗi
$done({ body: JSON.stringify(obj) });