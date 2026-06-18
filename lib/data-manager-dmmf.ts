import { Prisma } from '@prisma/client'
import type { FieldType, ResolvedField, ResolvedMeta } from './data-manager-meta'
import { TABLE_META_OVERRIDES } from './data-manager-meta'

export function toPrismaKey(modelName: string): string {
  return modelName.charAt(0).toLowerCase() + modelName.slice(1)
}

export function getDmmfModels() {
  return Prisma.dmmf.datamodel.models
}

function getModelDmmf(modelName: string) {
  return Prisma.dmmf.datamodel.models.find((m) => m.name === modelName)
}

// All fields including relations (needed for FK detection)
export function getAllModelFields(modelName: string): Prisma.DMMF.Field[] {
  return (getModelDmmf(modelName)?.fields ?? []) as Prisma.DMMF.Field[]
}

// Scalar + enum fields only (no relation objects)
export function getScalarFields(modelName: string): Prisma.DMMF.Field[] {
  return getAllModelFields(modelName).filter(
    (f) => f.kind === 'scalar' || f.kind === 'enum',
  )
}

export function deriveFieldType(field: Prisma.DMMF.Field): FieldType {
  if (field.kind === 'enum') return 'select'
  switch (field.type) {
    case 'Boolean':          return 'boolean'
    case 'Int': case 'Float': return 'number'
    case 'DateTime':         return 'datetime'
    default:                 return 'text'
  }
}

export function getEnumOptions(enumName: string): string[] {
  return (
    Prisma.dmmf.datamodel.enums.find((e) => e.name === enumName)
      ?.values.map((v) => v.name) ?? []
  )
}

export function isAutoReadonly(
  field: Prisma.DMMF.Field,
  allFields: Prisma.DMMF.Field[],
): boolean {
  // Primary key
  if (field.isId) return true
  // @updatedAt
  if (field.isUpdatedAt) return true
  // DateTime @default(now()) — createdAt pattern
  const def = field.default as { name?: string } | null | undefined
  if (
    field.type === 'DateTime' &&
    def !== null &&
    def !== undefined &&
    typeof def === 'object' &&
    def.name === 'now'
  ) return true
  // Foreign key: scalar ending in 'Id' with a matching relation field in this model
  if (
    field.name.endsWith('Id') &&
    allFields.some(
      (f) => f.kind === 'object' && f.name === field.name.slice(0, -2),
    )
  ) return true
  return false
}

export function buildResolvedMeta(tableName: string): ResolvedMeta | null {
  const dmmfModel = getDmmfModels().find((m) => toPrismaKey(m.name) === tableName)
  if (!dmmfModel) return null

  const override = TABLE_META_OVERRIDES.find((t) => t.key === tableName)
  const allFields = getAllModelFields(dmmfModel.name)
  const scalarFields = getScalarFields(dmmfModel.name)

  const fieldNames = override?.fields ?? scalarFields.map((f) => f.name)

  const resolvedFields: ResolvedField[] = fieldNames
    .map((name): ResolvedField | null => {
      const dmmfField = allFields.find((f) => f.name === name)
      if (!dmmfField || (dmmfField.kind !== 'scalar' && dmmfField.kind !== 'enum')) return null

      const fo = override?.fieldMeta?.[name]
      const autoRo = isAutoReadonly(dmmfField, allFields)

      return {
        name,
        type:     fo?.type ?? deriveFieldType(dmmfField),
        readonly: fo?.readonly ?? autoRo,
        options:  fo?.options ?? (dmmfField.kind === 'enum' ? getEnumOptions(dmmfField.type) : undefined),
      }
    })
    .filter((f): f is ResolvedField => f !== null)

  return {
    key:         tableName,
    label:       override?.label ?? dmmfModel.name,
    description: override?.description ?? '',
    fields:      resolvedFields,
  }
}

export function buildAllResolvedMeta(): ResolvedMeta[] {
  return getDmmfModels()
    .map((m) => buildResolvedMeta(toPrismaKey(m.name)))
    .filter((m): m is ResolvedMeta => m !== null)
}
