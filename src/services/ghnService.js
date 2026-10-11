/**
 * GHN (Giao Hàng Nhanh) Master Data Service
 * API Documentation: https://developer.ghn.vn/vi/docs/master-data/get-province
 */

export const GHN_DEV_API = 'https://dev-online-gateway.ghn.vn/shiip/public-api/master-data';
export const GHN_PROD_API = 'https://online-gateway.ghn.vn/shiip/public-api/master-data';

export const DEFAULT_GHN_TOKEN = '78be1310-ffe5-11f0-a3d6-dac90fb956b5';

const CANDIDATE_GATEWAYS = [
  GHN_DEV_API,
  GHN_PROD_API,
];

let activeGateway = (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GHN_API_URL?.trim()) || GHN_DEV_API;

// Standard 63 Vietnam Provinces/Cities Fallback
export const FALLBACK_VIETNAM_PROVINCES = [
  { ProvinceID: 202, ProvinceName: 'TP. Hồ Chí Minh', Code: 'SG' },
  { ProvinceID: 201, ProvinceName: 'Hà Nội', Code: 'HN' },
  { ProvinceID: 203, ProvinceName: 'Đà Nẵng', Code: 'DN' },
  { ProvinceID: 204, ProvinceName: 'Hải Phòng', Code: 'HP' },
  { ProvinceID: 205, ProvinceName: 'Cần Thơ', Code: 'CT' },
  { ProvinceID: 206, ProvinceName: 'An Giang', Code: 'AG' },
  { ProvinceID: 207, ProvinceName: 'Bà Rịa - Vũng Tàu', Code: 'VT' },
  { ProvinceID: 208, ProvinceName: 'Bắc Giang', Code: 'BG' },
  { ProvinceID: 209, ProvinceName: 'Bắc Kạn', Code: 'BK' },
  { ProvinceID: 210, ProvinceName: 'Bạc Liêu', Code: 'BL' },
  { ProvinceID: 211, ProvinceName: 'Bắc Ninh', Code: 'BN' },
  { ProvinceID: 212, ProvinceName: 'Bến Tre', Code: 'BT' },
  { ProvinceID: 213, ProvinceName: 'Bình Định', Code: 'BD' },
  { ProvinceID: 214, ProvinceName: 'Bình Dương', Code: 'BI' },
  { ProvinceID: 215, ProvinceName: 'Bình Phước', Code: 'BP' },
  { ProvinceID: 216, ProvinceName: 'Bình Thuận', Code: 'BTH' },
  { ProvinceID: 217, ProvinceName: 'Cà Mau', Code: 'CM' },
  { ProvinceID: 218, ProvinceName: 'Cao Bằng', Code: 'CB' },
  { ProvinceID: 219, ProvinceName: 'Đắk Lắk', Code: 'DL' },
  { ProvinceID: 220, ProvinceName: 'Đắk Nông', Code: 'DN' },
  { ProvinceID: 221, ProvinceName: 'Điện Biên', Code: 'DB' },
  { ProvinceID: 222, ProvinceName: 'Đồng Nai', Code: 'DNA' },
  { ProvinceID: 223, ProvinceName: 'Đồng Tháp', Code: 'DT' },
  { ProvinceID: 224, ProvinceName: 'Gia Lai', Code: 'GL' },
  { ProvinceID: 225, ProvinceName: 'Hà Giang', Code: 'HG' },
  { ProvinceID: 226, ProvinceName: 'Hà Nam', Code: 'HNA' },
  { ProvinceID: 227, ProvinceName: 'Hà Tĩnh', Code: 'HT' },
  { ProvinceID: 228, ProvinceName: 'Hải Dương', Code: 'HD' },
  { ProvinceID: 229, ProvinceName: 'Hậu Giang', Code: 'HGI' },
  { ProvinceID: 230, ProvinceName: 'Hòa Bình', Code: 'HB' },
  { ProvinceID: 231, ProvinceName: 'Hưng Yên', Code: 'HY' },
  { ProvinceID: 232, ProvinceName: 'Khánh Hòa', Code: 'KH' },
  { ProvinceID: 233, ProvinceName: 'Kiên Giang', Code: 'KG' },
  { ProvinceID: 234, ProvinceName: 'Kon Tum', Code: 'KT' },
  { ProvinceID: 235, ProvinceName: 'Lai Châu', Code: 'LC' },
  { ProvinceID: 236, ProvinceName: 'Lâm Đồng', Code: 'LD' },
  { ProvinceID: 237, ProvinceName: 'Lạng Sơn', Code: 'LS' },
  { ProvinceID: 238, ProvinceName: 'Lào Cai', Code: 'LCA' },
  { ProvinceID: 239, ProvinceName: 'Long An', Code: 'LA' },
  { ProvinceID: 240, ProvinceName: 'Nam Định', Code: 'ND' },
  { ProvinceID: 241, ProvinceName: 'Nghệ An', Code: 'NA' },
  { ProvinceID: 242, ProvinceName: 'Ninh Bình', Code: 'NB' },
  { ProvinceID: 243, ProvinceName: 'Ninh Thuận', Code: 'NT' },
  { ProvinceID: 244, ProvinceName: 'Phú Thọ', Code: 'PT' },
  { ProvinceID: 245, ProvinceName: 'Phú Yên', Code: 'PY' },
  { ProvinceID: 246, ProvinceName: 'Quảng Bình', Code: 'QB' },
  { ProvinceID: 247, ProvinceName: 'Quảng Nam', Code: 'QNA' },
  { ProvinceID: 248, ProvinceName: 'Quảng Ngãi', Code: 'QNG' },
  { ProvinceID: 249, ProvinceName: 'Quảng Ninh', Code: 'QN' },
  { ProvinceID: 250, ProvinceName: 'Quảng Trị', Code: 'QT' },
  { ProvinceID: 251, ProvinceName: 'Sóc Trăng', Code: 'ST' },
  { ProvinceID: 252, ProvinceName: 'Sơn La', Code: 'SL' },
  { ProvinceID: 253, ProvinceName: 'Tây Ninh', Code: 'TN' },
  { ProvinceID: 254, ProvinceName: 'Thái Bình', Code: 'TB' },
  { ProvinceID: 255, ProvinceName: 'Thái Nguyên', Code: 'TNG' },
  { ProvinceID: 256, ProvinceName: 'Thanh Hóa', Code: 'TH' },
  { ProvinceID: 257, ProvinceName: 'Thừa Thiên Huế', Code: 'TTH' },
  { ProvinceID: 258, ProvinceName: 'Tiền Giang', Code: 'TG' },
  { ProvinceID: 259, ProvinceName: 'Trà Vinh', Code: 'TV' },
  { ProvinceID: 260, ProvinceName: 'Tuyên Quang', Code: 'TQ' },
  { ProvinceID: 261, ProvinceName: 'Vĩnh Long', Code: 'VL' },
  { ProvinceID: 262, ProvinceName: 'Vĩnh Phúc', Code: 'VP' },
  { ProvinceID: 263, ProvinceName: 'Yên Bái', Code: 'YB' },
];

// Fallback Districts for major regions
export const FALLBACK_DISTRICTS_BY_PROVINCE = {
  // TP. Hồ Chí Minh
  202: [
    { DistrictID: 1442, DistrictName: 'Quận 1' },
    { DistrictID: 1443, DistrictName: 'Quận 3' },
    { DistrictID: 1444, DistrictName: 'Quận 4' },
    { DistrictID: 1446, DistrictName: 'Quận 5' },
    { DistrictID: 1447, DistrictName: 'Quận 6' },
    { DistrictID: 1448, DistrictName: 'Quận 7' },
    { DistrictID: 1449, DistrictName: 'Quận 8' },
    { DistrictID: 1450, DistrictName: 'Quận 10' },
    { DistrictID: 1451, DistrictName: 'Quận 11' },
    { DistrictID: 1452, DistrictName: 'Quận 12' },
    { DistrictID: 1453, DistrictName: 'Quận Bình Thạnh' },
    { DistrictID: 1454, DistrictName: 'Quận Gò Vấp' },
    { DistrictID: 1455, DistrictName: 'Quận Phú Nhuận' },
    { DistrictID: 1456, DistrictName: 'Quận Tân Bình' },
    { DistrictID: 1457, DistrictName: 'Quận Tân Phú' },
    { DistrictID: 1458, DistrictName: 'Quận Bình Tân' },
    { DistrictID: 3695, DistrictName: 'Thành Phố Thủ Đức' },
    { DistrictID: 1460, DistrictName: 'Huyện Bình Chánh' },
    { DistrictID: 1461, DistrictName: 'Huyện Hóc Môn' },
    { DistrictID: 1462, DistrictName: 'Huyện Củ Chi' },
    { DistrictID: 1463, DistrictName: 'Huyện Nhà Bè' },
    { DistrictID: 1464, DistrictName: 'Huyện Cần Giờ' },
  ],
  // Hà Nội
  201: [
    { DistrictID: 1482, DistrictName: 'Quận Ba Đình' },
    { DistrictID: 1484, DistrictName: 'Quận Hoàn Kiếm' },
    { DistrictID: 1485, DistrictName: 'Quận Tây Hồ' },
    { DistrictID: 1486, DistrictName: 'Quận Long Biên' },
    { DistrictID: 1488, DistrictName: 'Quận Cầu Giấy' },
    { DistrictID: 1489, DistrictName: 'Quận Đống Đa' },
    { DistrictID: 1490, DistrictName: 'Quận Hai Bà Trưng' },
    { DistrictID: 1491, DistrictName: 'Quận Hoàng Mai' },
    { DistrictID: 1492, DistrictName: 'Quận Thanh Xuân' },
    { DistrictID: 1493, DistrictName: 'Quận Nam Từ Liêm' },
    { DistrictID: 1494, DistrictName: 'Quận Bắc Từ Liêm' },
    { DistrictID: 1495, DistrictName: 'Quận Hà Đông' },
    { DistrictID: 1496, DistrictName: 'Thị xã Sơn Tây' },
    { DistrictID: 1497, DistrictName: 'Huyện Đông Anh' },
    { DistrictID: 1498, DistrictName: 'Huyện Gia Lâm' },
  ],
  // Đà Nẵng
  203: [
    { DistrictID: 1530, DistrictName: 'Quận Hải Châu' },
    { DistrictID: 1531, DistrictName: 'Quận Thanh Khê' },
    { DistrictID: 1532, DistrictName: 'Quận Sơn Trà' },
    { DistrictID: 1533, DistrictName: 'Quận Ngũ Hành Sơn' },
    { DistrictID: 1534, DistrictName: 'Quận Liên Chiểu' },
    { DistrictID: 1535, DistrictName: 'Quận Cẩm Lệ' },
    { DistrictID: 1536, DistrictName: 'Huyện Hòa Vang' },
  ],
  // Hải Phòng
  204: [
    { DistrictID: 1540, DistrictName: 'Quận Hồng Bàng' },
    { DistrictID: 1541, DistrictName: 'Quận Ngô Quyền' },
    { DistrictID: 1542, DistrictName: 'Quận Lê Chân' },
    { DistrictID: 1543, DistrictName: 'Quận Hải An' },
    { DistrictID: 1544, DistrictName: 'Quận Kiến An' },
  ],
  // Cần Thơ
  205: [
    { DistrictID: 1550, DistrictName: 'Quận Ninh Kiều' },
    { DistrictID: 1551, DistrictName: 'Quận Bình Thủy' },
    { DistrictID: 1552, DistrictName: 'Quận Cái Răng' },
    { DistrictID: 1553, DistrictName: 'Quận Ô Môn' },
  ],
};

// Fallback Wards for major districts
export const FALLBACK_WARDS_BY_DISTRICT = {
  // Quận 1 (TP.HCM)
  1442: [
    { WardCode: '20101', WardName: 'Phường Bến Nghé' },
    { WardCode: '20102', WardName: 'Phường Bến Thành' },
    { WardCode: '20103', WardName: 'Phường Đa Kao' },
    { WardCode: '20104', WardName: 'Phường Tân Định' },
    { WardCode: '20105', WardName: 'Phường Phạm Ngũ Lão' },
    { WardCode: '20106', WardName: 'Phường Cầu Ông Lãnh' },
    { WardCode: '20107', WardName: 'Phường Cô Giang' },
    { WardCode: '20108', WardName: 'Phường Nguyễn Thái Bình' },
    { WardCode: '20109', WardName: 'Phường Cầu Kho' },
    { WardCode: '20110', WardName: 'Phường Nguyễn Cư Trinh' },
  ],
  // Quận 3 (TP.HCM)
  1443: [
    { WardCode: '20201', WardName: 'Phường Võ Thị Sáu' },
    { WardCode: '20202', WardName: 'Phường 1' },
    { WardCode: '20203', WardName: 'Phường 2' },
    { WardCode: '20204', WardName: 'Phường 3' },
    { WardCode: '20205', WardName: 'Phường 4' },
    { WardCode: '20206', WardName: 'Phường 5' },
    { WardCode: '20207', WardName: 'Phường 9' },
    { WardCode: '20208', WardName: 'Phường 11' },
    { WardCode: '20209', WardName: 'Phường 12' },
    { WardCode: '20210', WardName: 'Phường 14' },
  ],
  // Quận 4 (TP.HCM)
  1444: [
    { WardCode: '20301', WardName: 'Phường 1' },
    { WardCode: '20302', WardName: 'Phường 2' },
    { WardCode: '20303', WardName: 'Phường 3' },
    { WardCode: '20304', WardName: 'Phường 4' },
    { WardCode: '20306', WardName: 'Phường 6' },
    { WardCode: '20308', WardName: 'Phường 8' },
    { WardCode: '20309', WardName: 'Phường 9' },
    { WardCode: '20313', WardName: 'Phường 13' },
    { WardCode: '20315', WardName: 'Phường 15' },
    { WardCode: '20318', WardName: 'Phường 18' },
  ],
  // Quận 5 (TP.HCM)
  1446: [
    { WardCode: '20401', WardName: 'Phường 1' },
    { WardCode: '20402', WardName: 'Phường 2' },
    { WardCode: '20403', WardName: 'Phường 3' },
    { WardCode: '20404', WardName: 'Phường 4' },
    { WardCode: '20405', WardName: 'Phường 5' },
    { WardCode: '20407', WardName: 'Phường 7' },
    { WardCode: '20411', WardName: 'Phường 11' },
    { WardCode: '20414', WardName: 'Phường 14' },
  ],
  // Quận 7 (TP.HCM)
  1448: [
    { WardCode: '20601', WardName: 'Phường Tân Thuận Đông' },
    { WardCode: '20602', WardName: 'Phường Tân Thuận Tây' },
    { WardCode: '20603', WardName: 'Phường Tân Kiểng' },
    { WardCode: '20604', WardName: 'Phường Tân Hưng' },
    { WardCode: '20605', WardName: 'Phường Bình Thuận' },
    { WardCode: '20606', WardName: 'Phường Tân Quy' },
    { WardCode: '20607', WardName: 'Phường Phú Thuận' },
    { WardCode: '20608', WardName: 'Phường Tân Phú' },
    { WardCode: '20609', WardName: 'Phường Tân Phong' },
    { WardCode: '20610', WardName: 'Phường Phú Mỹ' },
  ],
  // Quận 10 (TP.HCM)
  1450: [
    { WardCode: '20701', WardName: 'Phường 1' },
    { WardCode: '20702', WardName: 'Phường 2' },
    { WardCode: '20704', WardName: 'Phường 4' },
    { WardCode: '20706', WardName: 'Phường 6' },
    { WardCode: '20709', WardName: 'Phường 9' },
    { WardCode: '20712', WardName: 'Phường 12' },
    { WardCode: '20714', WardName: 'Phường 14' },
    { WardCode: '20715', WardName: 'Phường 15' },
  ],
  // Quận 12 (TP.HCM) - District 1452
  1452: [
    { WardCode: '20811', WardName: 'Phường Tân Thới Nhất' },
    { WardCode: '20812', WardName: 'Phường Tân Hưng Thuận' },
    { WardCode: '20813', WardName: 'Phường Đông Hưng Thuận' },
    { WardCode: '20814', WardName: 'Phường Trung Mỹ Tây' },
    { WardCode: '20815', WardName: 'Phường Tân Chánh Hiệp' },
    { WardCode: '20816', WardName: 'Phường Thới An' },
    { WardCode: '20817', WardName: 'Phường Hiệp Thành' },
    { WardCode: '20818', WardName: 'Phường Tân Thới Hiệp' },
    { WardCode: '20819', WardName: 'Phường Thạnh Lộc' },
    { WardCode: '20820', WardName: 'Phường Thạnh Xuân' },
    { WardCode: '20821', WardName: 'Phường An Phú Đông' },
  ],
  // Quận Bình Thạnh (TP.HCM)
  1453: [
    { WardCode: '20822', WardName: 'Phường 22' },
    { WardCode: '20825', WardName: 'Phường 25' },
    { WardCode: '20826', WardName: 'Phường 26' },
    { WardCode: '20827', WardName: 'Phường 27' },
    { WardCode: '20828', WardName: 'Phường 28' },
    { WardCode: '20819', WardName: 'Phường 19' },
    { WardCode: '20801', WardName: 'Phường 1' },
    { WardCode: '20802', WardName: 'Phường 2' },
    { WardCode: '20803', WardName: 'Phường 3' },
    { WardCode: '20805', WardName: 'Phường 5' },
    { WardCode: '20806', WardName: 'Phường 6' },
    { WardCode: '20807', WardName: 'Phường 7' },
    { WardCode: '20811', WardName: 'Phường 11' },
    { WardCode: '20812', WardName: 'Phường 12' },
    { WardCode: '20813', WardName: 'Phường 13' },
    { WardCode: '20814', WardName: 'Phường 14' },
    { WardCode: '20815', WardName: 'Phường 15' },
    { WardCode: '20817', WardName: 'Phường 17' },
    { WardCode: '20821', WardName: 'Phường 21' },
    { WardCode: '20824', WardName: 'Phường 24' },
  ],
  // Quận Gò Vấp (TP.HCM)
  1454: [
    { WardCode: '20901', WardName: 'Phường 1' },
    { WardCode: '20903', WardName: 'Phường 3' },
    { WardCode: '20904', WardName: 'Phường 4' },
    { WardCode: '20905', WardName: 'Phường 5' },
    { WardCode: '20907', WardName: 'Phường 7' },
    { WardCode: '20908', WardName: 'Phường 8' },
    { WardCode: '20910', WardName: 'Phường 10' },
    { WardCode: '20911', WardName: 'Phường 11' },
    { WardCode: '20916', WardName: 'Phường 16' },
    { WardCode: '20917', WardName: 'Phường 17' },
  ],
  // Quận Tân Bình (TP.HCM)
  1456: [
    { WardCode: '21001', WardName: 'Phường 1' },
    { WardCode: '21002', WardName: 'Phường 2' },
    { WardCode: '21004', WardName: 'Phường 4' },
    { WardCode: '21006', WardName: 'Phường 6' },
    { WardCode: '21008', WardName: 'Phường 8' },
    { WardCode: '21010', WardName: 'Phường 10' },
    { WardCode: '21012', WardName: 'Phường 12' },
    { WardCode: '21013', WardName: 'Phường 13' },
    { WardCode: '21014', WardName: 'Phường 14' },
    { WardCode: '21015', WardName: 'Phường 15' },
  ],
  // TP. Thủ Đức (TP.HCM) - District 3695
  3695: [
    { WardCode: '21601', WardName: 'Phường Thảo Điền' },
    { WardCode: '21602', WardName: 'Phường An Phú' },
    { WardCode: '21603', WardName: 'Phường Thủ Thiêm' },
    { WardCode: '21604', WardName: 'Phường Hiệp Phú' },
    { WardCode: '21605', WardName: 'Phường Tăng Nhơn Phú A' },
    { WardCode: '21606', WardName: 'Phường Tăng Nhơn Phú B' },
    { WardCode: '21607', WardName: 'Phường Phước Long A' },
    { WardCode: '21608', WardName: 'Phường Phước Long B' },
    { WardCode: '21609', WardName: 'Phường Linh Xuân' },
    { WardCode: '21610', WardName: 'Phường Linh Trung' },
    { WardCode: '21611', WardName: 'Phường Linh Chiểu' },
    { WardCode: '21612', WardName: 'Phường Linh Đông' },
    { WardCode: '21613', WardName: 'Phường Hiệp Bình Chánh' },
    { WardCode: '21614', WardName: 'Phường Hiệp Bình Phước' },
  ],
  // Quận Cầu Giấy (Hà Nội)
  1488: [
    { WardCode: '10201', WardName: 'Phường Dịch Vọng' },
    { WardCode: '10202', WardName: 'Phường Dịch Vọng Hậu' },
    { WardCode: '10203', WardName: 'Phường Quan Hoa' },
    { WardCode: '10204', WardName: 'Phường Trung Hòa' },
    { WardCode: '10205', WardName: 'Phường Nghĩa Đô' },
    { WardCode: '10206', WardName: 'Phường Nghĩa Tân' },
    { WardCode: '10207', WardName: 'Phường Yên Hòa' },
    { WardCode: '10208', WardName: 'Phường Mai Dịch' },
  ],
  // Quận Hoàn Kiếm (Hà Nội)
  1484: [
    { WardCode: '10101', WardName: 'Phường Tràng Tiền' },
    { WardCode: '10102', WardName: 'Phường Hàng Trống' },
    { WardCode: '10103', WardName: 'Phường Cửa Đông' },
    { WardCode: '10104', WardName: 'Phường Hàng Bài' },
    { WardCode: '10105', WardName: 'Phường Hàng Bạc' },
  ],
  // Quận Ba Đình (Hà Nội)
  1482: [
    { WardCode: '10001', WardName: 'Phường Điện Biên' },
    { WardCode: '10002', WardName: 'Phường Đội Cấn' },
    { WardCode: '10003', WardName: 'Phường Giảng Võ' },
    { WardCode: '10004', WardName: 'Phường Kim Mã' },
    { WardCode: '10005', WardName: 'Phường Liễu Giai' },
  ],
  // Quận Hải Châu (Đà Nẵng)
  1530: [
    { WardCode: '30101', WardName: 'Phường Hải Châu 1' },
    { WardCode: '30102', WardName: 'Phường Hải Châu 2' },
    { WardCode: '30103', WardName: 'Phường Thạch Thang' },
    { WardCode: '30104', WardName: 'Phường Thanh Bình' },
    { WardCode: '30105', WardName: 'Phường Thuận Phước' },
    { WardCode: '30106', WardName: 'Phường Hòa Thuận Đông' },
    { WardCode: '30107', WardName: 'Phường Hòa Thuận Tây' },
  ],
  // Quận Sơn Trà (Đà Nẵng)
  1532: [
    { WardCode: '30201', WardName: 'Phường An Hải Bắc' },
    { WardCode: '30202', WardName: 'Phường An Hải Tây' },
    { WardCode: '30203', WardName: 'Phường An Hải Đông' },
    { WardCode: '30204', WardName: 'Phường Phước Mỹ' },
    { WardCode: '30205', WardName: 'Phường Nại Hiên Đông' },
  ],
};

const getGeneratedFallbackWards = (districtId) => {
  return [
    { WardCode: `w_${districtId}_01`, WardName: 'Phường 1' },
    { WardCode: `w_${districtId}_02`, WardName: 'Phường 2' },
    { WardCode: `w_${districtId}_03`, WardName: 'Phường 3' },
    { WardCode: `w_${districtId}_04`, WardName: 'Phường 4' },
    { WardCode: `w_${districtId}_05`, WardName: 'Phường 5' },
    { WardCode: `w_${districtId}_tt`, WardName: 'Thị trấn trung tâm' },
    { WardCode: `w_${districtId}_x1`, WardName: 'Xã Tân Phú' },
    { WardCode: `w_${districtId}_x2`, WardName: 'Xã Hòa Bình' },
  ];
};

export const getGhnToken = () => {
  return (
    (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GHN_TOKEN) ||
    localStorage.getItem('GHN_TOKEN') ||
    DEFAULT_GHN_TOKEN
  ).trim();
};

export const setGhnToken = (token) => {
  if (token && token.trim()) {
    localStorage.setItem('GHN_TOKEN', token.trim());
  } else {
    localStorage.removeItem('GHN_TOKEN');
  }
};

/**
 * Execute request across GHN candidate gateways (Dev Sandbox vs Production)
 */
const requestGhn = async (pathWithQuery) => {
  const token = getGhnToken();
  if (!token) return { success: false, data: null };

  const gateways = [activeGateway, ...CANDIDATE_GATEWAYS.filter((g) => g !== activeGateway)];

  for (const gw of gateways) {
    try {
      const response = await fetch(`${gw}${pathWithQuery}`, {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          Token: token,
        },
      });

      if (response.ok) {
        const json = await response.json();
        if (json.code === 200 && Array.isArray(json.data) && json.data.length > 0) {
          activeGateway = gw; // lock in the working gateway
          return { success: true, isLive: true, data: json.data, gateway: gw };
        }
      }
    } catch {
      // Gateway network error, try next candidate
    }
  }

  return { success: false, data: null };
};

/**
 * Fetch list of provinces from GHN master-data
 * https://developer.ghn.vn/vi/docs/master-data/get-province
 */
export const getGhnProvinces = async () => {
  const res = await requestGhn('/province');
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    const sorted = [...res.data].sort((a, b) =>
      (a.ProvinceName || '').localeCompare(b.ProvinceName || '', 'vi')
    );
    return { success: true, isLive: true, data: sorted };
  }

  return {
    success: true,
    isLive: false,
    data: FALLBACK_VIETNAM_PROVINCES,
  };
};

/**
 * Fetch districts by provinceId from GHN master-data
 * https://developer.ghn.vn/vi/docs/master-data/get-district
 */
export const getGhnDistricts = async (provinceId) => {
  if (!provinceId) return { success: true, isLive: false, data: [] };

  const res = await requestGhn(`/district?province_id=${provinceId}`);
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    const sorted = [...res.data].sort((a, b) =>
      (a.DistrictName || '').localeCompare(b.DistrictName || '', 'vi')
    );
    return { success: true, isLive: true, data: sorted };
  }

  // Graceful fallback to local dataset if available
  const fallback = FALLBACK_DISTRICTS_BY_PROVINCE[Number(provinceId)] || [];
  return { success: true, isLive: false, data: fallback };
};

/**
 * Fetch wards by districtId from GHN master-data
 * https://developer.ghn.vn/vi/docs/master-data/get-ward
 */
export const getGhnWards = async (districtId) => {
  if (!districtId) return { success: true, isLive: false, data: [] };

  const res = await requestGhn(`/ward?district_id=${districtId}`);
  if (res.success && Array.isArray(res.data) && res.data.length > 0) {
    const sorted = [...res.data].sort((a, b) =>
      (a.WardName || '').localeCompare(b.WardName || '', 'vi')
    );
    return { success: true, isLive: true, data: sorted };
  }

  // Graceful fallback to local dataset if available, or generate standard wards
  const fallback = FALLBACK_WARDS_BY_DISTRICT[Number(districtId)] || getGeneratedFallbackWards(districtId);
  return { success: true, isLive: false, data: fallback };
};
