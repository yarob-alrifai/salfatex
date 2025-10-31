import { Product, ProductFabric, ProductUnitOption } from './catalog.models';

export const DEFAULT_FABRIC_NAME = 'Основная ткань';

function uniqueValues(values: string[]): string[] {
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)));
}

function sanitizeUnitOptions(
  options: ProductUnitOption[] | undefined,
  fallback: ProductUnitOption[]
): ProductUnitOption[] {
  const source = Array.isArray(options) ? options : [];
  const normalized = source.filter((option) => Number.isFinite(option?.price) && option.price > 0);
  return normalized.length ? normalized : fallback;
}

function sanitizeColors(colors: string[] | undefined, fallback: string[]): string[] {
  const source = uniqueValues(Array.isArray(colors) ? colors : []);
  if (source.length) {
    return source;
  }
  return fallback;
}

function getTopLevelColors(product: Product): string[] {
  return uniqueValues(
    [product.color, ...(product.colors ?? [])].filter((value): value is string => Boolean(value))
  );
}

function getFallbackUnitOptions(product: Product): ProductUnitOption[] {
  if (product.unitOptions?.length) {
    return product.unitOptions;
  }
  return [
    {
      type: 'piece',
      price: product.price ?? 0,
    },
  ];
}

function normalizeFabric(
  fabric: ProductFabric,
  fallbackColors: string[],
  fallbackUnitOptions: ProductUnitOption[]
): ProductFabric {
  const name = fabric?.name?.trim() || DEFAULT_FABRIC_NAME;
  const colors = sanitizeColors(fabric?.colors, fallbackColors);
  const unitOptions = sanitizeUnitOptions(fabric?.unitOptions, fallbackUnitOptions);
  return { name, colors, unitOptions };
}

export function getProductFabrics(product: Product): ProductFabric[] {
  const fallbackColors = getTopLevelColors(product);
  const fallbackUnitOptions = getFallbackUnitOptions(product);

  if (Array.isArray(product.fabrics) && product.fabrics.length) {
    const fabrics = product.fabrics
      .map((fabric) => normalizeFabric(fabric, fallbackColors, fallbackUnitOptions))
      .filter((fabric) => fabric.unitOptions.length);

    if (fabrics.length) {
      return fabrics;
    }
  }

  return [
    normalizeFabric(
      {
        name: product.fabrics?.[0]?.name ?? DEFAULT_FABRIC_NAME,
        colors: fallbackColors,
        unitOptions: product.unitOptions ?? [],
      },
      fallbackColors,
      fallbackUnitOptions
    ),
  ];
}

export function getProductAllColors(product: Product): string[] {
  return uniqueValues(
    getProductFabrics(product)
      .flatMap((fabric) => fabric.colors ?? [])
      .filter((value): value is string => Boolean(value))
  );
}

export function getProductAllUnitOptions(product: Product): ProductUnitOption[] {
  const fabrics = getProductFabrics(product);
  return fabrics.flatMap((fabric) => fabric.unitOptions ?? []);
}

export function getFabricMinimumPrice(fabric: ProductFabric): number {
  const prices = (fabric.unitOptions ?? [])
    .map((option) => option?.price)
    .filter((price): price is number => Number.isFinite(price));

  if (!prices.length) {
    return 0;
  }

  return Math.min(...prices);
}

export function getProductMinimumPrice(product: Product): number {
  const prices = getProductAllUnitOptions(product)
    .map((option) => option?.price)
    .filter((price): price is number => Number.isFinite(price));

  if (!prices.length) {
    return product.price ?? 0;
  }

  return Math.min(...prices);
}
