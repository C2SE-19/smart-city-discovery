export const navigationGroups = [
  {
    title: 'Command Center',
    items: [
      {
        label: 'Overview',
        path: '/',
        code: 'OV',
        description: 'Tổng quan kiến trúc, chia module và mốc sprint.'
      },
      {
        label: 'Discovery',
        path: '/discovery',
        code: 'USR',
        description: 'Luồng người dùng cuối: khám phá, lọc phường, tìm kiếm.'
      }
    ]
  },
  {
    title: 'Role Tracks',
    items: [
      {
        label: 'Admin GIS',
        path: '/admin/boundaries',
        code: 'ADM',
        description: 'Quản lý ranh giới, duyệt địa điểm và QA bản đồ.'
      },
      {
        label: 'Merchant Studio',
        path: '/merchant/workbench',
        code: 'MCH',
        description: 'Luồng merchant ghim quán, hồ sơ địa điểm và ads.'
      },
      {
        label: 'AI Lab',
        path: '/ai-lab',
        code: 'AI',
        description: 'Recommendation, image recognition và chatbot contracts.'
      }
    ]
  }
];

export const projectStats = [
  { label: 'Core domains', value: '5', trend: 'GIS, discovery, admin, merchant, AI' },
  { label: 'Primary roles', value: '3', trend: 'Admin, Merchant, User' },
  { label: 'Working APIs', value: '3', trend: 'test-db, wards, venues' },
  { label: 'Current stage', value: 'Sprint 1.5', trend: 'GIS core running, AI pending' }
];

export const roleStreams = [
  {
    title: 'Admin',
    eyebrow: 'System governance',
    description: 'Quản lý GeoJSON, duyệt venue, kiểm soát moderation và vận hành revenue.',
    points: ['Boundary upload and redraw', 'Pending venue approvals', 'User moderation and reports']
  },
  {
    title: 'Merchant',
    eyebrow: 'Business onboarding',
    description: 'Thả ghim quán, hoàn thiện profile, quản lý promo packages và xem hiệu quả ads.',
    points: ['Map pin submission', 'Menu and gallery upload', 'Push-to-top and time-slot ads']
  },
  {
    title: 'User',
    eyebrow: 'Discovery experience',
    description: 'Tìm địa điểm, lọc theo phường, review và nhận gợi ý theo ngữ cảnh.',
    points: ['Search and nearby map', 'Ward filters and saved places', 'Ratings, comments and report flow']
  }
];

export const frontendTracks = [
  {
    title: 'Frontend Pod 1',
    folder: 'frontend/src/features/discovery',
    owner: '1 frontend member',
    scope: 'Search UX, ward filters, venue list, recommendation slots.'
  },
  {
    title: 'Frontend Pod 2',
    folder: 'frontend/src/features/admin',
    owner: '1 frontend member',
    scope: 'Admin GIS, moderation dashboard, ward management tools.'
  },
  {
    title: 'Frontend Pod 3',
    folder: 'frontend/src/features/merchant',
    owner: '1 frontend member',
    scope: 'Merchant onboarding, venue form, ad package and transaction UI.'
  },
  {
    title: 'Frontend Pod 4',
    folder: 'frontend/src/features/ai',
    owner: '1 frontend member',
    scope: 'Chatbot panel, image upload, recommendation explanation layer.'
  }
];

export const backendTracks = [
  {
    title: 'Backend Pod 1',
    folder: 'backend/src/modules/venues + gis',
    owner: '1 backend member',
    scope: 'Venue CRUD, ward detection, point-in-polygon and geo validation.'
  },
  {
    title: 'Backend Pod 2',
    folder: 'backend/src/modules/auth',
    owner: '1 backend member',
    scope: 'JWT auth, RBAC, role permissions and profile endpoints.'
  },
  {
    title: 'Backend Pod 3',
    folder: 'backend/src/modules/recommendations',
    owner: '1 backend or AI member',
    scope: 'Weather context, AI orchestration and model-facing contracts.'
  },
  {
    title: 'Backend Pod 4',
    folder: 'backend/src/modules/system + future admin modules',
    owner: '1 backend member',
    scope: 'Monitoring, moderation queue, ads packages and analytics APIs.'
  }
];

export const sprintBoard = [
  {
    title: 'Sprint 1',
    status: 'Foundation in place',
    deliverables: ['Map rendering', 'Ward polygons', 'Venue listing', 'Point-in-polygon backend']
  },
  {
    title: 'Sprint 2',
    status: 'Ready to split',
    deliverables: ['Context recommendation API', 'Image recognition flow', 'Chat assistant contracts']
  },
  {
    title: 'Sprint 3',
    status: 'Scaffolded',
    deliverables: ['Merchant dashboard', 'Admin moderation', 'Ads and notifications']
  }
];

export const aiContracts = [
  {
    title: 'Recommendation Engine',
    endpoint: 'POST /api/v1/recommendations/contextual',
    payload: 'weather + time + preferenceTags + location',
    output: 'ranked venues with reasons'
  },
  {
    title: 'Food Recognition',
    endpoint: 'POST /api/v1/recommendations/image-recognition',
    payload: 'imageUrl or upload token',
    output: 'dish label + nearby venues'
  },
  {
    title: 'AI Chat',
    endpoint: 'POST /api/v1/recommendations/chat',
    payload: 'question + context snapshot',
    output: 'answer + suggested venues + follow-up prompts'
  }
];