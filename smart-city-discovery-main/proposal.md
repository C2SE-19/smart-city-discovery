4. Problem Statement
4.1. Current situation
At present, the demand for finding dining and entertainment venues is rapidly increasing among locals and tourists who seek personalized experiences. However, several issues still exist in current discovery platforms:
Merger of provinces and cities: The consolidation of administrative boundaries creates confusion in locating addresses and exploring local venues.
Too many choices: Users see hundreds of results on a map, making it very hard to decide where to go.
Not smart enough: Most apps do not check the real-time weather or time. For example, they might suggest an outdoor cafe even when it is raining.
Limited personalization: Suggestions are often generic or based solely on location, failing to align with individual user preferences such as taste, pricing, or atmosphere.
Marketing difficulties for local merchants: Small and medium-sized local businesses often struggle to compete with large chains for visibility, lacking accessible tools to promote their services during peak hours.
Inefficient search methods: Searching requires typing specific keywords, while modern needs for visual search (scanning food images) are rarely integrated into local discovery apps.
4.2. Impacts of this problem
Current mainstream map platforms (e.g., Google Maps) suffer from a significant "data lag" in updating new administrative boundaries following the city's consolidation (merger). This results in a disconnect between real-world addresses and digital maps, causing frustration for users who cannot locate venues based on the new ward/commune names.
Merger of provinces and cities in Vietnam: People may be unfamiliar with the food and entertainment options associated with neighboring provinces and cities.
Mismatched recommendations: Suggestions that ignore weather or personal taste result in dissatisfaction (e.g., visiting an open-air spot on a hot day).
Lost revenue for shops: Many good local shops ("hidden gems") remain unknown because they cannot reach customers nearby.
Reduced engagement: Without interactive features like AI chat or personalized alerts, users tend to use platforms only passively and infrequently.
4.3. Reason for Topic Selection
The topic "Smart City Discovery Platform using Context-Adaptive AI" was selected to address two critical challenges in the current urban landscape.
Firstly, bridging the "Geospatial Data Gap" caused by administrative consolidation. The recent merger of provinces and cities has rendered many existing digital maps obsolete, creating significant confusion regarding new boundaries and addresses. To solve this, our project constructs a Self-hosted Map Layer that visualizes the newly established administrative boundaries (wards/communes). Crucially, this platform empowers the community and local business owners to actively pin and introduce their venues directly onto these new administrative units. This ensures that even if global maps (like Google Maps) lag in updates, our users can still accurately locate and promote services within the correct new legal boundaries.
Secondly, solving "Decision Paralysis" via Context-Aware AI. Users currently face information overload from static tools that provide hundreds of generic results. By integrating Context-Aware AI, this project transforms the experience from "manual searching" to "intelligent receiving." The system acts as a smart concierge, automatically recommending venues based on real-time weather, time of day, and personal hobbies (e.g., suggesting a cozy indoor café during a sudden rainstorm). Furthermore, it supports local SMEs by providing accessible marketing tools ("Push-to-Top"), helping them compete effectively in the digital economy.
5. Survey / Existing Solutions
Currently, users rely on general map services or review platforms (Foody) to find venues. While these platforms provide massive data, they suffer from information overload and lack context-awareness, often suggesting places without considering real-time weather or specific user needs.
The context-aware AI-based smart city discovery platform solves this problem by using AI to analyze the weather, time, and personal preferences to make highly relevant recommendations. At the same time, we also created a map design using OSM to create a map suitable for the merger of provinces and cities in Vietnam. The table below compares the existing approaches to the proposed solution, highlighting the advantages of integrating AI and supporting merchants
Table 1. Comparison of Existing Solutions and SCD-AI
Criteria	Existing Solution 	Proposed 
Scope	General location search, static directory, manual filtering by keywords.	Context-aware discovery; suggestions adapt to real-time weather (e.g., rain, heat) and time; AI visual search.
Main users	General public looking for addresses or navigation.	Explorers seeking personalized suggestions; Merchants needing targeted promotion tools.
Core features	Map navigation, basic reviews, static photos, keyword search.	AI Recommendation Engine (Weather/Time/Interest), AI Image Recognition (Scan food), Merchant "Push-to-Top" ads.
Complexity	High data volume but low processing of user context; manual interaction required.	High personalization; automated analysis of external factors (weather API) to refine results instantly.
Unique Point	Huge database but generic suggestions; creates "decision paralysis."	"Right Place, Right Time": Solves decision fatigue with AI; empowers local businesses with accessible marketing tools.
Geospatial Accuracy
	Static & Delayed: Relies on global providers that lag in updating local administrative changes (e.g., displaying outdated wards post-merger).
	Dynamic & Adaptive: Implements a Self-hosted GIS Layer using GeoJSON to visualize updated administrative boundaries immediately, ensuring 100% addressing accuracy.
In summary, while existing solutions provide a vast amount of raw data, they often leave users overwhelmed and force them to manually filter through options that may not suit the current moment (e.g., outdoor seating during rain). The proposed Context-Aware AI-Driven Smart City Discovery Platform system stands out by integrating AI-driven context analysis and visual search, offering a smarter, more personalized discovery experience while providing local merchants with effective tools to reach customers during peak hours. 
6. Objectives and Scope
6.1. Objectives
a) General Objective:
To develop an intelligent, context-aware web platform that connects users with local dining, coffee, and entertainment venues. The system leverages AI technology to personalize recommendations based on real-time weather, time, and user preferences, while providing local merchants with effective marketing tools to enhance visibility and business growth.
b) Specific Objectives:
Develop an AI-driven Recommendation Engine that analyzes external factors (weather, time) and internal data (user interest tags) to suggest the most suitable venues automatically.
Integrate AI Image Recognition to allow users to search for food and restaurants by scanning or uploading photos of dishes.
Build a comprehensive Map-based Discovery System (using OSM to build a map) that supports location tracking, routing, and checking nearby amenities.
Enable User-Generated Content mechanisms, allowing the community to contribute to new locations, write reviews, and report inaccuracies to keep data fresh and reliable.
Provide a Monetization & Marketing Module for merchants, including "Push-to-Top" services and timeslot-based advertising to reach customers during peak hours.
Create a centralized Admin Dashboard for managing content, moderating user reports, configuring system parameters, and tracking revenue statistics.
6.2. In Scope
6.2.1. Admin
Manage user accounts (lock/unlock users) and verify merchant profiles
Manage Map Layers & Administrative Boundaries: Directly update and adjust geospatial data (GeoJSON) to redefine ward/commune boundaries, ensuring the map accurately reflects the latest administrative consolidation (merger).
Review and approve new locations submitted by users to prevent duplicate data.
Manage administrative categories (Ward/Commune) and service types (Cafe, Restaurant).
Monitor system performance and view revenue analytics from advertising packages.
Handle reported content (spam reviews, fake locations) to maintain community standards.
Configure pricing and parameters for "Push-to-Top" and time-slot advertisement packages.


6.2.2. User
Register and manage personal profiles with specific interest tags 
Search for locations by keyword, category, or radius (Near me).
Receive Context-Aware Recommendations tailored to the current weather and time.
Use AI Visual Search to identify food from images and find selling locations.
Contribute to the platform by adding new locations, rating venues, and writing comments.
Bookmark/Save favorite locations and receive notifications about interactions.
7. Key Features & Requirements
7.1. Key Features
7.1.1. User Profile & Contextual Personalization (User)
Smart Profile Management: Users can register/login and define specific Interest Tags (e.g., "Quiet Space," "Street Food," "Luxury," "Nightlife"). These tags serve as the baseline for the personalization engine.
Activity History: Users can view their past activities, including reviewed locations, submitted posts, and transaction history (for merchants).

7.1.2. AI-Driven Discovery & Recommendation (User)
Context-Adaptive Suggestions: The core feature where the system analyzes Real-time Weather (via OpenWeather API), Time of Day, and User Tags to automatically generate a ranked list of suitable venues (e.g., suggesting cozy indoor coffee shops during rain or bustling rooftop bars on a clear night). 
AI Visual Search: Users can upload an image of a dish or a venue; the AI Service analyzes the image to identify the content (e.g., "Bun Bo Hue") and lists nearby locations serving that item. 
AI Chatbot Assistant: A conversational interface where users can ask questions (e.g., "Where should I go for a date tonight?"), and the AI provides recommendations based on current context.
7.1.3. Community & Content Contribution (User, Admin)
User-Generated Content (UGC): Users can contribute to the platform by Registering New Locations (Venues) that are not yet on the map. These submissions are sent to the Admin for approval.
Interaction & Feedback: Users can submit Ratings and Comments for venues. They can also Report Abuse (Flagged Content) if they encounter fake or inappropriate posts.
7.1.4. Merchant Services & Monetization (Merchant/User)
Strategic Content Promotion: Merchants are empowered to create and manage high-quality promotional posts to showcase their venues, highlight special events, or introduce seasonal menus, thereby actively attracting potential customers.
Ad Package Management: Venue owners can leverage premium advertising services such as "Push-to-Top" (maximizing visibility in search results) or "Time-Slot Ads" (targeting users during specific peak hours like lunch or dinner) to drive traffic effectively.
Secure Payment Integration: The platform seamlessly integrates with a secure Payment Gateway to facilitate instant transaction processing for ad packages, ensuring financial safety and providing automated digital receipts for business tracking.
7.1.5. System Administration (Admin)
Content Moderation: Admins receive a list of "Flagged/Reported Content" and "Pending Posts" to Approve or Reject, ensuring data quality.
Map & Administrative Boundary Management: Administrators have direct access to update spatial data (GeoJSON) to adjust and redraw ward/commune boundaries. This feature ensures the map system accurately reflects the latest changes following the administrative consolidation (merger), addressing the issue of delayed updates often found in mainstream map providers.
Business Management: Admins can Manage Ad Packages (adjust pricing, define package types) and Manage Users (ban violating accounts).
Analytics Dashboard: Admins have access to Revenue & Sales Reports to monitor business performance.
7.2. Requirements
7.2.1. Functional Requirements (FR)
Table 2. Functional Requirements - Admin
ADMIN
Number	Description
FR1	Secure login for administrators to access the management dashboard.
FR2	Create, update, and delete administrative categories (Ward/Commune) and Service Types (Cafe, Restaurant, Entertainment) to organize venue data.
FR3	View a list of user-submitted venues. The Admin can Approve (publish to map) or Reject (with reason) these submissions.
FR4	View and resolve "Flagged/Reported Content" sent by users regarding fake locations or spam reviews.
FR5	View user lists and change account status (Active/Banned) for violating community standards.
FR6	Configure the price, duration, and features of advertising packages (e.g., "Push-to-Top").
FR7	View visual charts and reports on revenue generated from Ad Package sales.
FR8	Manage Map Layers & Geospatial Data. The Admin can upload, update, or adjust GeoJSON files to redefine administrative boundaries (Wards/Communes), ensuring the map visualization accurately reflects the latest city consolidation (merger).





Table 3. Functional Requirements - User (Visitor & Merchant)
			USER
Number	Description
FR1	Register/Login and update "Preference Tags" (e.g., Spicy food, Outdoor, Quiet) to personalize the AI engine.
FR2	Search for venues using keywords, categories, or GPS-based radius (Nearby). View results on a map built using OpenStreetMap data.
FR3	Receive a list of suggested venues calculated based on Real-time Weather (OpenWeather), Time, and User Tags.
FR4	Upload an image of food or a venue. The AI Service scans the image and returns a list of matching locations.
FR5	Chat with an AI Assistant to request recommendations via natural language.
FR6	Submit data for a new location (Name, Menu, Address, Photos) to the system for approval.
FR7	Rate venues (1-5 stars), write comments, and report incorrect information.
FR8	Request to purchase "Ad Packages". The system redirects to the Payment Gateway for processing.
FR9	View "Activity History" (posted reviews, visited places) and "Transaction History/Ad Stats" (for merchants).
7.2.2. Non-Functional Requirements (NFR)
Performance & Scalability
NFR-01 (Response Time): The core system (Search, Venue Details) must respond to user requests within 2 seconds under normal load.
NFR-02 (AI Latency): The Context-Adaptive AI Engine (analyzing Weather + Time + Tags) must generate recommendation lists within 3 seconds to maintain user engagement.
NFR-03 (Image Processing): The AI Visual Search module should process uploaded images and return recognition results within 5 seconds.
NFR-04 (Concurrency): The system must support at least 500 concurrent users performing search and viewing map details simultaneously without service degradation.
NFR-05 (Scalability): The backend architecture (Node.js) and database must support horizontal scaling to accommodate future growth in data volume (thousands of venues) and user traffic.
Reliability & Availability
NFR-06 (Uptime): The system should ensure 99.9% uptime during business hours (7 AM - 10 PM) to support merchants and visitors.
NFR-07 (Fault Tolerance - External APIs): The system must have fallback mechanisms. If external services (e.g., OpenWeather API) fail or time out, the system must switch to a "Default Recommendation Mode" (based on popularity) instead of crashing or showing an error.
NFR-08 (Data Consistency): The system must periodically synchronize (or validate) cached location data sourced from OSM(OpenStreetMap) to prevent displaying closed or non-existent venues.
Security & Privacy
NFR-09 (Authentication): All API endpoints must be secured using JWT (JSON Web Tokens) to prevent unauthorized access.
NFR-10 (Data Protection): User passwords must be hashed (e.g., using bcrypt) before storage. Sensitive personal data (email, phone) must be encrypted.
NFR-11 (Payment Security): All transactions for "Ad Packages" must be processed via the Payment Gateway's Sandbox/Secure environment. The system must not store users' banking card details directly in the database.
Usability & Compatibility
NFR-12 (Ease of Use): The "Post a New Location" process for users/merchants should not exceed 3 steps to encourage community contribution.
NFR-13 (Localization): The system interface should support Vietnamese (primary) and English to serve both locals and tourists.
AI Accuracy (Specific for Capstone)
NFR-14 (Recommendation Relevance): The AI recommendation algorithm should achieve a relevance score of at least 80% (validated through user feedback/ratings).
NFR-15 (Recognition Accuracy): The AI Image Recognition model should correctly identify common local dishes (defined in the dataset) with an accuracy of at least 85% under good lighting conditions.
8. Project Constraints and Assumptions
8.1. Project Constraints
Table 4. Project Constraints
Constraint	Description	Guidelines for Acceptance
Economic	The project was developed within a student budget, relying heavily on free-tier services such as OpenStreetMap (OSM), the Weather API, Supabase, and an open-source library. Advanced AI infrastructure and large-scale deployments are limited due to financial constraints.	Optimize cloud usage, reuse open-source tools, and prioritize core features.
Technical	AI recommendation accuracy depends on data quality (user behavior, weather API, venue data). Free API quotas may limit real-time requests.	Implement caching, fallback logic, and optimize API usage.
Environment	The system operates digitally and does not generate physical waste. Environmental impact mainly comes from cloud computing and user devices.	Use efficient cloud hosting and optimize system performance to reduce energy consumption.
Ethical	The system handles personal preferences and location data. Ethical concerns include user privacy, responsible AI recommendations, and avoiding biased promotion of venues.	Apply data encryption, user consent mechanisms, transparent recommendation logic, and fair exposure for merchants.
Public Safety & Welfare	Incorrect venue data or AI recommendations may negatively affect user experience (e.g., suggesting closed locations).	Admin moderation, user reporting, and periodic data validation.
Social & Global	The system targets urban users but may face challenges adapting to rural areas or different countries due to data availability.	Design modular architecture and multilingual support for future expansion.
Cultural	Dining and entertainment preferences vary by region and culture.	Allow customizable categories, local filters, and culturally appropriate UI/UX.
8.2. Assumptions
Users access the platform via web browsers with stable internet connections.
Users have basic digital literacy to use map-based and AI-assisted features.
Merchants provide accurate venue information and promotional content.
Weather API services remain available during development.
User-generated content (reviews, locations) is assumed mostly honest, with admin moderation support.
AI recommendation accuracy is expected to reach at least 75–80% relevance based on available data.
Data privacy regulations allow storing user profiles and activity data on Supabase.
9. Target User / Stakeholders
9.1. Target Users
Context-Aware AI-Driven Smart City Discovery Platform system is designed for the following user groups:
General Users (Explorers): 
oIndividuals seeking dining, coffee, and entertainment locations.
oWant fast, personal recommendations based on weather, time, and preferences.
oUse AI visual search and chatbot for discovery.
Merchants (Business Owners):
oCan bookmark locations, write reviews, and contribute new places.
oPromote their using “Push-to-Top” and time-slot advertisements.
oManage venue profiles, menus, and promotional images.
oTrack engagement and visibility through the system.
Admins (System managers):
oManage users, merchants, and submitted locations.
oModerate content and handle reports.
oConfigure advertising pricing.
oMonitor analytics, trending venues, and system performance.
oManage Map Layers: Update administrative boundaries (GeoJSON) to reflect city consolidation.
9.2. Stakeholders
Table 5. Stakeholders and User Descriptions Summary
Name	Description	Role
Product Owner	Defines the product vision, prioritizes requirements, and works with stakeholders to ensure the system meets real user needs.	Anh, Tran Duc
Scrum Master	Facilitates the Scrum process, removes impediments, organizes sprint activities, and ensures smooth team collaboration.	Khoa, Vo Van Anh
Requirement Analyzer	Collaborates with guardians, caregivers, and admins to correctly translate needs into system requirements.	All Members
Software Architect	Designs the system architecture, selects technologies, and ensures performance, security, and scalability.	All Members
Coder	Responsible for programming and implementing booking, reporting, AI analysis, and payment modules.	All Members
Tester	Ensures the system meets functional and non-functional requirements through testing.	All Members
10. Technology Stack
Frontend:
ReactJS (for building responsive web interfaces)
HTML5, CSS3, JavaScript (UI design and styling)
Tailwind CSS (Utility-first CSS framework for faster and consistent UI development)
React-Leaflet & Leaflet.js (Open-source JavaScript library for interactive maps, replacing Google Maps SDK)
Backend:
Node.js with Express (server-side logic and RESTful APIs)
Authentication with JWT (basic login and role-based access control)
Turf.js (Advanced geospatial analysis engine for executing "Point-in-Polygon" algorithms to determine administrative boundaries automatically)
Database:
PostgreSQL (Relational database for storing user information, bookings, payments, and GeoJSON data for new administrative boundaries)
Storage:
Supabase Storage (to upload and manage images such as caregiver profiles, venue menus, and check-in photos)
Payment Gateway:
VNPAY (used for online payments in the demo system)
         External APIs & Map Services:
OpenStreetMap (OSM): Primary source for geospatial data (roads, paths, and venues).
CartoDB Voyager: Base map tile provider (provides clean, distraction-free map tiles for overlaying custom administrative boundaries).
OpenWeather API: For retrieving real-time weather conditions (Temperature, Rain/Sun) to feed the AI engine.
AI & Analytics:
Framework: Flask or FastAPI (To expose AI models as APIs for the Node.js backend)
Recommendation Engine: Uses Scikit-learn or TensorFlow to implement Context-Aware Filtering (processing Weather, Time, and Tags).
Computer Vision: Uses TensorFlow/Keras (e.g., MobileNetV2) for food image recognition.
Data Processing: Pandas & NumPy for handling weather and user interaction datasets.
Development Environment:
Visual Studio Code 
GitHub (source code management and collaboration)
11. Methodology & Development Plan
11.1. Methodology

Figure 1. Scrum
Scrum is an agile framework for software development that follows an iterative and incremental approach, helping teams manage complex projects and product development effectively.
It is particularly well-suited for environments where detailed upfront planning is difficult, emphasizing adaptability and flexibility.
Unlike traditional command-and-control project management methods, Scrum relies on empirical process control, using continuous feedback loops as a core technique to guide decision-making and progress.
Scrum empowers teams by shifting decision-making authority to those directly involved in the development process, allowing them to respond more effectively to real-world conditions and uncertainties.
Key benefits of using Scrum include:
Enhanced ability to adapt to change.
Early detection of problems and issues.
Prioritization of the most valuable features for the customer.
Deliverables that better align with customer needs.
Increased team productivity.
Consistent and predictable delivery timelines.
11.2. Development Plan (Timeline schedule)
Table 6. Timeline Schedule
NO	Task Name	Duration	Start	Finish
1	Initial Phase	5 days	27/01/2026	31/01/2026
1.1	Requirement Analysis & Refinement	3 days	27/01/2026	29/01/2026
1.2	System Design & Architecture Finalization	2 days	30/01/2026	31/01/2026
2	Start Up	7 days	01/02/2026	07/02/2026
2.1	Project Kick-off & Repo Setup	1 day	01/02/2026	01/02/2026
2.2	Database Design & Env Setup	6 days	02/02/2026	07/02/2026
3	Development	84 days	08/02/2026	02/05/2026
3.1	Sprint 1: Core Features (Auth, Search) & User Module	28 days	08/02/2026	07/03/2026
3.2	Sprint 2: AI Features (Recommendation)	28 days	08/03/2026	04/04/2026
3.3	Sprint 3: Merchant, Admin & Notification System	28 days	05/04/2026	02/05/2026
4	Project Meeting & Testing	8 days	03/05/2026	10/05/2026
4.1	Final Testing & Bug Fixing	5 days	03/05/2026	07/05/2026
4.2	Documentation & Slide Preparation	3 days	08/05/2026	10/05/2026
5	Final Release	1 day	11/05/2026	11/05/2026
12. System Architecture Overview
12.1. System Context Diagram
Figure 2. Context Diagram
12.2. System Context Description
a) Main Actors
       User (Visitor & Merchant)
Search & Discovery: Sends search queries combined with current GPS location to find venues.
AI Interaction: Uploads food or venue images for AI scanning and interacts with the AI Chatbot for assistance.
Contribution: Submits new locations via Map Pinning (Crowdsourcing), submits ratings, comments, and reports inappropriate content.
Profile Management: Registers/Logins and updates personal preferences (tags) to improve recommendation accuracy.
Business Features: Requests the purchase of "Ad Packages" (Push-to-Top) and views transaction history and ad performance statistics (View Stats).
Receives: AI-driven suggested location lists, detailed venue information, map visualizations, and system notifications regarding post/ad approval status.
Admin
Management: Manages user accounts (bans/unbans), configures Ad Packages (pricing/types), and updates Administrative Boundaries (GeoJSON) for the map system.
Moderation: Reviews, approves, or rejects user-submitted posts (New Locations) to ensure data quality.
Monitoring: Receives reports on revenue, sales, and flagged/reported content from the community.
Communication: Issues system-wide announcements to all users.
b) External Systems
Map Tile Server (OpenStreetMap/CartoDB)
Input: Receives requests for map tiles based on coordinates and zoom levels (XYZ/PNG).
Output: Returns Base Map Tiles to visualize the city background. (Note: Place details and administrative logic are handled internally by the system, not fetched from this external provider).
OpenWeather API
Input: Receives the current coordinates of the user.
Output: Provides real-time weather data (temperature, rain/sun conditions). This data is a critical input for the "Context-Adaptive AI" to adjust recommendations (e.g., suggesting indoor venues during rain).
AI Service (Python Module)
Input: Receives user context data (Time, Weather, Preference Tags), chat queries, and image URLs.
Output: Returns processed AI responses, including the list of recommended venues, identified food names from images, and natural language chat responses.
Payment Gateway (VNPay/Sepay)
Input: Receives payment requests (Amount, Order Info) when a user purchases an Ad Package.
Output: Returns the transaction status (Success/Failure) to update the system records