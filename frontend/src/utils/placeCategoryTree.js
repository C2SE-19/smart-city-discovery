export const DEFAULT_PLACE_CATEGORY_ICON = '📍';

function normalizeSortOrder(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeParentId(value) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

function deriveParentIdFromSlug(category, categories, categoryById) {
  const explicitParentId = normalizeParentId(category?.parent_id ?? category?.parentId);
  if (explicitParentId && categoryById.has(explicitParentId)) {
    return explicitParentId;
  }

  const categoryId = Number(category?.id);
  const categorySlug = String(category?.slug || '').trim().toLowerCase();

  if (!categorySlug) {
    return null;
  }

  let matchedParentId = null;
  let matchedParentSlugLength = 0;

  categories.forEach((candidate) => {
    const candidateId = Number(candidate?.id);
    const candidateSlug = String(candidate?.slug || '').trim().toLowerCase();

    if (!Number.isInteger(candidateId) || candidateId <= 0 || candidateId === categoryId || !candidateSlug) {
      return;
    }

    if (!categorySlug.startsWith(`${candidateSlug}-`)) {
      return;
    }

    if (candidateSlug.length > matchedParentSlugLength) {
      matchedParentId = candidateId;
      matchedParentSlugLength = candidateSlug.length;
    }
  });

  return matchedParentId;
}

export function normalizeCategoryIcon(icon) {
  const normalized = String(icon || '').trim();
  return normalized || DEFAULT_PLACE_CATEGORY_ICON;
}

export function sortPlaceCategories(firstCategory, secondCategory) {
  const orderDifference =
    normalizeSortOrder(firstCategory?.sort_order ?? firstCategory?.sortOrder)
    - normalizeSortOrder(secondCategory?.sort_order ?? secondCategory?.sortOrder);

  if (orderDifference !== 0) {
    return orderDifference;
  }

  return String(firstCategory?.name || '').localeCompare(String(secondCategory?.name || ''));
}

export function buildPlaceCategoryTree(categories) {
  const normalizedCategories = Array.isArray(categories) ? [...categories].sort(sortPlaceCategories) : [];
  const categoryById = new Map();

  normalizedCategories.forEach((category) => {
    const categoryId = Number(category?.id);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      categoryById.set(categoryId, category);
    }
  });

  const childrenByParentId = new Map();
  const rootCategories = [];

  normalizedCategories.forEach((category) => {
    const categoryId = Number(category?.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return;
    }

    const parentId = deriveParentIdFromSlug(category, normalizedCategories, categoryById);
    if (parentId && categoryById.has(parentId) && parentId !== categoryId) {
      if (!childrenByParentId.has(parentId)) {
        childrenByParentId.set(parentId, []);
      }

      childrenByParentId.get(parentId).push(category);
      return;
    }

    rootCategories.push(category);
  });

  childrenByParentId.forEach((children) => children.sort(sortPlaceCategories));
  rootCategories.sort(sortPlaceCategories);

  const descendantIdsByCategoryId = new Map();
  const rootCategoryIdByCategoryId = new Map();

  const collectDescendantIds = (categoryId, inheritedRootId = categoryId) => {
    if (descendantIdsByCategoryId.has(categoryId)) {
      return descendantIdsByCategoryId.get(categoryId);
    }

    rootCategoryIdByCategoryId.set(categoryId, inheritedRootId);
    const descendants = [categoryId];
    const childCategories = childrenByParentId.get(categoryId) || [];

    childCategories.forEach((childCategory) => {
      const childId = Number(childCategory.id);
      if (!Number.isInteger(childId) || childId <= 0) {
        return;
      }

      rootCategoryIdByCategoryId.set(childId, inheritedRootId);
      descendants.push(...collectDescendantIds(childId, inheritedRootId));
    });

    const uniqueDescendants = [...new Set(descendants)];
    descendantIdsByCategoryId.set(categoryId, uniqueDescendants);
    return uniqueDescendants;
  };

  rootCategories.forEach((category) => {
    const categoryId = Number(category.id);
    if (Number.isInteger(categoryId) && categoryId > 0) {
      collectDescendantIds(categoryId, categoryId);
    }
  });

  normalizedCategories.forEach((category) => {
    const categoryId = Number(category?.id);
    if (!Number.isInteger(categoryId) || categoryId <= 0) {
      return;
    }

    if (!descendantIdsByCategoryId.has(categoryId)) {
      descendantIdsByCategoryId.set(categoryId, [categoryId]);
    }

    if (!rootCategoryIdByCategoryId.has(categoryId)) {
      rootCategoryIdByCategoryId.set(categoryId, categoryId);
    }
  });

  return {
    categories: normalizedCategories,
    rootCategories,
    categoryById,
    childrenByParentId,
    descendantIdsByCategoryId,
    rootCategoryIdByCategoryId,
  };
}

export function expandCategorySelection(selectedCategoryIds, categoryTree) {
  const nextIds = new Set();

  (Array.isArray(selectedCategoryIds) ? selectedCategoryIds : []).forEach((categoryId) => {
    const normalizedCategoryId = Number(categoryId);
    if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
      return;
    }

    const descendantIds =
      categoryTree?.descendantIdsByCategoryId?.get(normalizedCategoryId)
      || [normalizedCategoryId];

    descendantIds.forEach((descendantId) => nextIds.add(Number(descendantId)));
  });

  return [...nextIds];
}

export function resolveCategoryBranch(selectedCategoryId, categoryTree) {
  const normalizedCategoryId = Number(selectedCategoryId);
  if (!Number.isInteger(normalizedCategoryId) || normalizedCategoryId <= 0) {
    return {
      mainCategory: null,
      subcategory: null,
    };
  }

  const category = categoryTree?.categoryById?.get(normalizedCategoryId) || null;
  if (!category) {
    return {
      mainCategory: null,
      subcategory: null,
    };
  }

  const rootCategoryId =
    categoryTree?.rootCategoryIdByCategoryId?.get(normalizedCategoryId)
    || normalizedCategoryId;
  const mainCategory = categoryTree?.categoryById?.get(rootCategoryId) || category;

  if (rootCategoryId === normalizedCategoryId) {
    return {
      mainCategory,
      subcategory: null,
    };
  }

  return {
    mainCategory,
    subcategory: category,
  };
}

export function formatCategoryBranchLabel(categoryId, categoryTree, fallbackLabel = 'Uncategorized') {
  const categoryBranch = resolveCategoryBranch(categoryId, categoryTree);
  const mainCategoryName = String(categoryBranch.mainCategory?.name || '').trim();
  const subcategoryName = String(categoryBranch.subcategory?.name || '').trim();

  if (mainCategoryName && subcategoryName) {
    return `${mainCategoryName} | ${subcategoryName}`;
  }

  if (mainCategoryName) {
    return mainCategoryName;
  }

  if (subcategoryName) {
    return subcategoryName;
  }

  return fallbackLabel;
}
