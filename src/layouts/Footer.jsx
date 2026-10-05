import React from 'react';
import { MapPin, Phone, Mail, Shield, Film, Award, ChevronRight } from 'lucide-react';

export default function Footer({ onTabChange = () => { }, cinema = null }) {
  return (
    <footer className="relative border-t border-white/[0.08] bg-[#050507] text-neutral-400 pt-12 pb-8 px-4 sm:px-6 lg:px-8">
      {/* Ambient subtle glow at top border */}
      <div className="pointer-events-none absolute top-0 left-1/2 -translate-x-1/2 h-[1px] w-3/4 bg-gradient-to-r from-transparent via-[#F7C600]/25 to-transparent" />

      <div className="mx-auto max-w-[1240px]">
        {/* Main Footer Grid (4 Columns) - Compact padding */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-10 pb-10 border-b border-white/[0.08]">

          {/* COLUMN 1: BRAND IDENTITY */}
          <div className="space-y-3">
            <div className="flex items-center space-x-2.5">
              <div className="h-8 w-8 flex items-center justify-center bg-zinc-950 border border-[#F7C600]/40 rounded-none shadow-[0_0_12px_rgba(247,198,0,0.15)]">
                <span className="font-serif italic font-black text-base text-[#F7C600]">C</span>
              </div>
              <div className="flex flex-col">
                <span className="font-sans font-black tracking-[0.22em] text-xs text-white uppercase leading-none">
                  CINE<span className="text-[#F7C600]">PREMIER</span>
                </span>
                <span className="text-[7px] font-mono tracking-[0.4em] text-neutral-400 uppercase mt-0.5 leading-none">
                  STUDIOS
                </span>
              </div>
            </div>

            <p className="text-[11.5px] leading-relaxed text-neutral-400 max-w-sm">
              Tổ hợp rạp chiếu phim chuẩn quốc tế với phòng chiếu IMAX Laser, Dolby Atmos 360° cùng trải nghiệm ẩm thực điện ảnh thượng hạng.
            </p>

            <div className="pt-1 space-y-1.5 text-[11.5px]">
              <div className="flex items-center gap-2 text-neutral-300">
                <Phone className="h-3.5 w-3.5 text-[#F7C600] shrink-0" />
                <span>Hotline: <strong className="text-white">1900 8888</strong> (08:00 - 23:00)</span>
              </div>
              <div className="flex items-center gap-2 text-neutral-300">
                <Mail className="h-3.5 w-3.5 text-purple-400 shrink-0" />
                <span>Email: <strong className="text-white">support@cinepremier.vn</strong></span>
              </div>
              <div className="flex items-start gap-2 text-neutral-400 pt-0.5">
                <MapPin className="h-3.5 w-3.5 text-[#F7C600] shrink-0 mt-0.5" />
                <span className="leading-snug">{cinema?.name ? `${cinema.name} - ${cinema.address || ''}` : '68 Nguyễn Huệ, Phường Bến Nghé, Quận 1, TP.HCM'}</span>
              </div>
            </div>
          </div>

          {/* COLUMN 2: KHÁM PHÁ ĐIỆN ẢNH */}
          <div>
            <h4 className="text-[12px] font-black uppercase tracking-[0.16em] text-[#F7C600] mb-3 flex items-center gap-1.5">
              <Film className="h-3.5 w-3.5" />
              <span>KHÁM PHÁ ĐIỆN ẢNH</span>
            </h4>
            <ul className="space-y-2 text-[11.5px] font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('explore')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Phim Đang Chiếu Rạp</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('explore')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Phim Sắp Khởi Chiếu</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('showtimes')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Lịch Chiếu Toàn Quốc</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('concessions')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Thực Đơn Bắp Nước F&B</span>
                </button>
              </li>
              <li>
                <span className="text-neutral-500 flex items-center gap-1.5">
                  <ChevronRight className="h-3 w-3 text-neutral-700" />
                  <span>Phòng Chiếu IMAX 70mm Laser</span>
                </span>
              </li>
            </ul>
          </div>

          {/* COLUMN 3: HỖ TRỢ & CHÍNH SÁCH */}
          <div>
            <h4 className="text-[12px] font-black uppercase tracking-[0.16em] text-white mb-3 flex items-center gap-1.5">
              <Shield className="h-3.5 w-3.5 text-purple-400" />
              <span>HỖ TRỢ & CHÍNH SÁCH</span>
            </h4>
            <ul className="space-y-2 text-[11.5px] font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('policies')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-purple-400 transition-colors" />
                  <span>Quy định đặt vé & hoàn tiền</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('policies')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-purple-400 transition-colors" />
                  <span>Chính sách bảo mật thông tin</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('policies')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-purple-400 transition-colors" />
                  <span>Quy định độ tuổi xem phim (T13, T16, T18)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('policies')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-purple-400 transition-colors" />
                  <span>Quy định phòng chiếu VIP Lounge</span>
                </button>
              </li>
            </ul>
          </div>

          {/* COLUMN 4: TÀI KHOẢN & ĐẶC QUYỀN HỘI VIÊN */}
          <div>
            <h4 className="text-[12px] font-black uppercase tracking-[0.16em] text-[#F7C600] mb-3 flex items-center gap-1.5">
              <Award className="h-3.5 w-3.5" />
              <span>CINEPREMIER CLUB</span>
            </h4>
            <ul className="space-y-2 text-[11.5px] font-medium">
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('profile')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Đăng ký thành viên mới (Tặng 50K)</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('my-tickets')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Tra cứu vé điện tử đã mua</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('wishlist')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Danh sách phim yêu thích</span>
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => onTabChange('profile')}
                  className="hover:text-white transition-colors flex items-center gap-1.5 group"
                >
                  <ChevronRight className="h-3 w-3 text-neutral-600 group-hover:text-[#F7C600] transition-colors" />
                  <span>Tích điểm CinePoints & Quà tặng</span>
                </button>
              </li>
            </ul>

            {/* Payment partners badges */}
            <div className="mt-3.5 pt-3 border-t border-white/[0.08]">
              <p className="text-[9.5px] font-bold uppercase tracking-wider text-neutral-400 mb-1.5">
                Phương thức thanh toán
              </p>
              <div className="flex flex-wrap items-center gap-1.5 text-[9px] font-mono font-bold text-neutral-300">
                <span className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5">VISA</span>
                <span className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5">MASTERCARD</span>
                <span className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5">NAPAS</span>
                <span className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5 text-pink-400">MOMO</span>
                <span className="rounded-none border border-white/10 bg-white/5 px-1.5 py-0.5 text-blue-400">ZALOPAY</span>
              </div>
            </div>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-[11px] text-neutral-400">
          <p>© 2026 CINEPREMIER STUDIOS. Tất cả quyền được bảo lưu.</p>
          <div className="flex items-center gap-4 text-neutral-400">
            <span className="hover:text-white cursor-pointer transition-colors">Điều khoản</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Bảo mật</span>
            <span>•</span>
            <span className="hover:text-white cursor-pointer transition-colors">Phòng vé</span>
          </div>
        </div>

      </div>
    </footer>
  );
}
