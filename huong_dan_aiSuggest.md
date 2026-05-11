Tiếp tục nâng cấp AI Suggest personalization vì hiện tại recommendation giữa nhiều user khác nhau vẫn gần như giống nhau.

Đây là vấn đề lớn vì AI Suggest hiện chưa thật sự cá nhân hóa theo profile user.

==================================================
PROBLEM HIỆN TẠI
================

Hiện tại:

* 2 account khác nhau
* cùng age range
* nhưng:

  * khác Gender
  * khác Time you usually go out
  * khác Interests

=> khi bấm AI Suggest vẫn trả gần như cùng một danh sách.

Điều này làm AI Suggest cảm giác chưa “personalized”.

==================================================
YÊU CẦU MỚI
===========

Recommendation phải thay đổi RÕ RÀNG giữa các user khác nhau.

AI Suggest phải thật sự dùng:

* Gender
* Time you usually go out
* Interests
* user behavior/context

để tạo recommendation khác nhau.

==================================================

1. INTERESTS PHẢI CÓ WEIGHT CAO HƠN
   ==================================================

Hiện tại Interests có vẻ weight quá thấp hoặc gần như không ảnh hưởng đủ mạnh.

Cần tăng mạnh score impact của Interests.

Ví dụ:

User A:

* Bubble tea
* Street food
* Cinema

THÌ top results nên ưu tiên:

* trà sữa
* ăn vặt
* rạp phim
* dining/snacks

---

User B:

* Parks
* Instagram spots
* Sports activities

THÌ top results nên ưu tiên:

* công viên
* check-in spots
* outdoor places
* sports venues

==================================================
2. TIME YOU USUALLY GO OUT PHẢI ẢNH HƯỞNG THẬT
==============================================

Ví dụ:

User A:

* Morning

=> ưu tiên:

* breakfast
* cafe sáng
* parks
* brunch

---

User B:

* Evening
* Late night

=> ưu tiên:

* entertainment
* nightlife
* lounge
* open-late venues

---

User C:

* Afternoon

=> ưu tiên:

* cafe
* shopping
* relax places

Hiện tại logic này chưa rõ ràng.

==================================================
3. GENDER CONTEXT
=================

KHÔNG bias vô lý.

Nhưng có thể dùng soft preference nhẹ.

Ví dụ:

* safety
* comfort
* suitable atmosphere
* venue style

Gender chỉ là soft signal.
KHÔNG override interests hoặc semantic intent.

==================================================
4. PERSONALIZATION DIVERSITY
============================

Recommendation list không được:

* y chang giữa nhiều user
* cùng thứ tự
* cùng top results

Cần diversify theo:

* profile
* interests
* time habits
* refine context

==================================================
5. PERSONALIZED SCORING
=======================

Scoring nên tách rõ:

semantic_intent_score
+
interest_match_score
+
time_habit_score
+
distance_score
+
weather_score
+
opening_score
+
HOT_bonus
+
popularity

==================================================
6. INTEREST MATCH LOGIC
=======================

Map interests vào categories/tags thực tế.

Ví dụ:

Bubble tea
=> drinks
=> milk tea
=> cafe

---

Cinema
=> entertainment
=> movies

---

Instagram spots
=> attractions
=> aesthetic cafe
=> check-in locations

---

Sports activities
=> outdoor
=> sports
=> parks

==================================================
7. EXPECTED RESULT
==================

Ví dụ:

2 user cùng age 18-24
NHƯNG:

USER A:

* Bubble tea
* Afternoon

=> top:

* trà sữa
* cafe
* snacks

---

USER B:

* Sports
* Evening

=> top:

* sports venues
* parks
* entertainment

==================================================
8. IMPORTANT
============

AI Suggest phải tạo cảm giác:
“đây là recommendation riêng cho user này”

KHÔNG phải:
“1 danh sách chung cho tất cả user”.

==================================================
9. DEBUG & VERIFY
=================

Sau khi sửa:
hãy log/debug thử:

* score breakdown
* interest contribution
* time contribution
* personalization contribution

để verify rằng mỗi user thật sự có ranking khác nhau.
