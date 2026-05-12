Tiếp tục sửa AI Suggest personalization.

Hiện tại mình đã bỏ :

* Time you usually go out

Nên recommendation KHÔNG cần dựa vào field này nữa.

AI Suggest hiện tại đang chủ yếu dựa:

* thời tiết hiện tại
* thời gian hiện tại
* độ tuổi
* HOT/popularity

Nên dù:

* khác Gender
* khác Interests

thì nhiều account vẫn ra gần giống nhau.

Điều này làm AI Suggest chưa thật sự personalized.

AI Suggest phải cá nhân hóa mạnh hơn dựa vào:

1. Gender
2. Interests
3. venue semantic context
4. services offered
5. venue description
6. venue atmosphere/style
7. realtime weather/time
8. distance
9. opening status

==================================================

1. INTERESTS PHẢI LÀ CORE PERSONALIZATION
   ==================================================

Interests phải là yếu tố personalization mạnh nhất.

Ví dụ:

USER A:

* Bubble tea
* Instagram spots

=> ưu tiên:

* milk tea
* aesthetic cafe
* checkin places
* drinks
* chill cafe

---

USER B:

* Sports activities
* Parks

=> ưu tiên:

* parks
* outdoor places
* activity venues
* sports locations

---

USER C:

* Cinema
* Street food

=> ưu tiên:

* cinema
* dining
* food
* entertainment

Gender KHÔNG được bias vô lý.

Nhưng có thể dùng như:

* soft preference
* comfort/safety signal
* atmosphere preference

Ví dụ:

* chill cafe
* aesthetic places
* sports venues
* nightlife
* family-friendly

Gender chỉ là:
SOFT SIGNAL.

KHÔNG override Interests.

Hiện tại recommendation vẫn quá generic theo category.

Cần phân tích venue dựa vào:

* venue name
* description
* services offered
* tags
* atmosphere
* semantic meaning

Services Offered phải trở thành core recommendation signal.

Ví dụ:

Live Music
=> nightlife
=> chill
=> entertainment

---

Free WiFi
=> cafe work
=> study
=> relax

---

Parking
=> family
=> long stay

---

Take away
=> quick food
=> drinks/snacks

Parse venue description để hiểu atmosphere.

Ví dụ:

* chill
* yên tĩnh
* sang trọng
* acoustic
* romantic
* family
* outdoor

=> convert thành semantic tags.

Venue name cũng phải được semantic analyzed.

Ví dụ:

* Coffee
* Lounge
* BBQ
* Seafood
* Cinema
* Retreat
* Homestay

=> infer venue style/type đúng hơn.

2 user:

* cùng age
* cùng weather/time context

NHƯNG:

* khác Gender
* khác Interests

=> recommendation PHẢI khác rõ ràng.

Không được:

* cùng top results
* cùng ranking
* cùng order

1. interest relevance
2. venue semantic relevance
3. services offered match
4. realtime weather/time
5. distance
6. opening status
7. gender soft signal
8. HOT boost
9. popularity

HOT chỉ là bonus nhỏ.

KHÔNG được:

* override interests
* override semantic relevance
* override personalization

USER A:

* Bubble tea
* Instagram spots

=> top:

* aesthetic cafe
* milk tea
* checkin cafe

---

USER B:

* Sports activities
* Parks

=> top:

* parks
* outdoor
* activity venues

---

USER C:

* Cinema
* Street food

=> top:

* cinema
* street food
* dining
* entertainment

Recommendation hiện tại đang:
“recommend categories”

Nhưng thứ mình cần là:
“recommend venues matching user lifestyle & interests”.

AI Suggest phải tạo cảm giác:
“đây là danh sách dành riêng cho user này”.
