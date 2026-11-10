/**
 * Validation logic cho việc chọn / bỏ chọn ghế trong phòng chiếu phim.
 * Rule: Không được để lại đúng 1 ghế AVAILABLE nằm giữa 2 ghế đã được OCCUPIED (X O X, X O B, B O X, B O B).
 * Cho phép ghế trống ở mép hàng / cạnh lối đi (O X X X, X X X O).
 * Cho phép từ 2 ghế trống liên tiếp trở lên (X O O X, X O O B, B O O X, B O O B).
 * Lối đi (aisle), khoảng trống layout hoặc ghế OFF chia thành các segment độc lập.
 */

/**
 * Chuẩn hóa loại ghế về một trong các loại chính: 'COUPLE', 'VIP', 'SINGLE'
 */
export const normalizeSeatType = (seatType) => {
  const norm = String(seatType || 'SINGLE').toUpperCase();
  if (norm === 'COUPLE') return 'COUPLE';
  if (norm === 'VIP') return 'VIP';
  return 'SINGLE';
};

/**
 * Lấy chỉ số cột hiển thị của ghế để xác định khoảng cách vật lý/layout
 */
export const getSeatCol = (seat) => {
  if (!seat) return 0;
  if (typeof seat.displayColumn === 'number') return seat.displayColumn;
  if (typeof seat.col === 'number') return seat.col;
  if (typeof seat.seatNumber === 'number') return seat.seatNumber;
  return 0;
};

/**
 * Chia danh sách ghế trong 1 hàng (đã sort) thành các segment liên tục.
 * Lối đi (aisle), khoảng trống layout hoặc ghế OFF (gap > 1) sẽ chia thành segment độc lập.
 */
export const splitRowIntoSegments = (rowSeats) => {
  if (!rowSeats || rowSeats.length === 0) return [];
  const sorted = [...rowSeats].sort((a, b) => (getSeatCol(a) - getSeatCol(b)) || (a.col - b.col));

  const segments = [];
  let currentSegment = [];

  for (const seat of sorted) {
    if (currentSegment.length === 0) {
      currentSegment.push(seat);
    } else {
      const prevSeat = currentSegment[currentSegment.length - 1];
      const gap = getSeatCol(seat) - getSeatCol(prevSeat);
      if (gap === 1) {
        currentSegment.push(seat);
      } else {
        segments.push(currentSegment);
        currentSegment = [seat];
      }
    }
  }

  if (currentSegment.length > 0) {
    segments.push(currentSegment);
  }

  return segments;
};

/**
 * Nhóm các ghế trong 1 segment thành các Logical Unit:
 * - Ghế đơn / VIP / Standard: 1 unit gồm 1 ghế (SINGLE).
 * - Cặp ghế đôi (Couple seat): 1 unit gồm 2 ghế (COUPLE).
 * Trạng thái isOccupied của unit được xác định qua hàm isOccupiedFn.
 */
export const buildLogicalUnits = (segmentSeats, isOccupiedFn) => {
  const units = [];
  let i = 0;

  while (i < segmentSeats.length) {
    const seat = segmentSeats[i];
    const isCouple = normalizeSeatType(seat.type) === 'COUPLE';

    if (isCouple && i + 1 < segmentSeats.length) {
      const nextSeat = segmentSeats[i + 1];
      if (normalizeSeatType(nextSeat.type) === 'COUPLE') {
        const pair = [seat, nextSeat];
        const isOccupied = pair.some(s => isOccupiedFn(s));
        units.push({
          type: 'COUPLE',
          seats: pair,
          isOccupied
        });
        i += 2;
        continue;
      }
    }

    units.push({
      type: 'SINGLE',
      seats: [seat],
      isOccupied: isOccupiedFn(seat)
    });
    i += 1;
  }

  return units;
};

/**
 * Kiểm tra xem trong 1 segment có xuất hiện pattern:
 * OCCUPIED - AVAILABLE(1 ghế) - OCCUPIED hay không.
 *
 * Quy tắc:
 * - Chỉ vi phạm khi có ĐÚNG 1 ghế available bị kẹp giữa 2 vị trí occupied.
 * - Khoảng trống từ 2 ghế available trở lên (X O O X, X O O B, v.v.): HỢP LỆ.
 * - Ghế trống ở đầu hoặc cuối segment (mép hàng, cạnh lối đi): HỢP LỆ (O X X X, X X X O).
 */
export const hasSingleSeatGapInSegment = (units) => {
  if (!units || units.length < 3) return false;

  let u = 0;
  while (u < units.length) {
    if (!units[u].isOccupied) {
      const runStart = u;
      let runAvailableSeats = 0;

      while (u < units.length && !units[u].isOccupied) {
        runAvailableSeats += units[u].seats.length;
        u++;
      }
      const runEnd = u - 1;

      // Cụm available bị kẹp cả 2 phía bởi OCCUPIED
      const hasLeftOccupied = runStart > 0 && units[runStart - 1].isOccupied;
      const hasRightOccupied = runEnd < units.length - 1 && units[runEnd + 1].isOccupied;

      if (hasLeftOccupied && hasRightOccupied && runAvailableSeats === 1) {
        return true;
      }
    } else {
      u++;
    }
  }

  return false;
};

/**
 * Validate toàn diện quy tắc không để lại 1 ghế trống đơn lẻ giữa các ghế đã occupied.
 *
 * @param {Array} proposedSelectedSeats Danh sách ghế được chọn trong proposed state
 * @param {Array} allSeats Toàn bộ danh sách ghế trong phòng chiếu (kèm status isBooked)
 * @param {string|null} targetRow (Tùy chọn) Chỉ validate hàng cụ thể bị ảnh hưởng khi click
 * @returns {{ valid: boolean, message?: string, row?: string }}
 */
export const validateNoSingleSeatGap = (proposedSelectedSeats, allSeats, targetRow = null) => {
  if (!allSeats || allSeats.length === 0) return { valid: true };

  const proposedIds = new Set((proposedSelectedSeats || []).map(s => s.id || `${s.row}${s.col}`));

  let rowsToCheck;
  if (targetRow) {
    rowsToCheck = [String(targetRow).toUpperCase()];
  } else {
    const touched = new Set((proposedSelectedSeats || []).map(s => String(s.row).toUpperCase()));
    rowsToCheck = Array.from(touched);
  }

  if (rowsToCheck.length === 0) return { valid: true };

  const isOccupied = (seat) => {
    const seatId = seat.id || `${seat.row}${seat.col}`;
    if (proposedIds.has(seatId)) return true;
    return Boolean(seat.isBooked);
  };

  for (const rowLabel of rowsToCheck) {
    const rowSeats = allSeats.filter(s => String(s.row).toUpperCase() === rowLabel);
    if (rowSeats.length === 0) continue;

    const segments = splitRowIntoSegments(rowSeats);

    for (const segment of segments) {
      const units = buildLogicalUnits(segment, isOccupied);
      if (hasSingleSeatGapInSegment(units)) {
        return {
          valid: false,
          row: rowLabel,
          message: 'Không thể chọn ghế này vì sẽ để lại 1 ghế trống đơn lẻ.'
        };
      }
    }
  }

  return { valid: true };
};

// Alias tương thích ngược cho code cũ
export const validateOrphanSeats = validateNoSingleSeatGap;
