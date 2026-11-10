import { z } from "zod";
import { isValidCpf, onlyDigits } from "./cpf";

export { formatCpf, isValidCpf, maskCpf, onlyDigits } from "./cpf";

/* Alfabeto do codigo publico do certificado: 32 simbolos sem ambiguos (0, 1, I, O).
   Deve ser o mesmo de public.generate_certificate_code() no banco. */
export const CERTIFICATE_CODE_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
export const CERTIFICATE_CODE_LENGTH = 10;

export const certificateCodeSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(
    new RegExp(`^[${CERTIFICATE_CODE_ALPHABET}]{${CERTIFICATE_CODE_LENGTH}}$`),
    "Codigo invalido. Use os 10 caracteres impressos no certificado.",
  );

const uuid = z.string().uuid();
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Informe uma data valida");

export const courseCategorySchema = z.enum(["nr", "profissionalizante", "parceria"]);
export type CourseCategory = z.infer<typeof courseCategorySchema>;

export const courseModalitySchema = z.enum(["presencial", "online", "hibrido"]);

const courseFields = {
  slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use letras minusculas, numeros e hifens"),
  name: z.string().trim().min(3, "Informe o nome do treinamento"),
  category: courseCategorySchema,
  nr_code: z
    .string()
    .regex(/^NR-\d{1,2}$/, "Use o formato NR-35")
    .nullable(),
  workload_hours: z.number({ invalid_type_error: "Informe a carga horaria" }).int("Use horas inteiras").positive("A carga horaria deve ser maior que zero"),
  syllabus: z.string(),
  modality: courseModalitySchema,
  validity_months: z.number().int().positive("A validade deve ser maior que zero").nullable(),
  active: z.boolean(),
};
const nrCodeMatchesCategory = {
  check: (c: { category: CourseCategory; nr_code: string | null }) => (c.category === "nr") === (c.nr_code !== null),
  message: "Informe o codigo da NR (ex.: NR-35) somente para cursos de NR",
};

export const courseInputSchema = z
  .object(courseFields)
  .refine(nrCodeMatchesCategory.check, { message: nrCodeMatchesCategory.message, path: ["nr_code"] });
export type CourseInput = z.infer<typeof courseInputSchema>;

export const courseSchema = z
  .object({ id: uuid, ...courseFields })
  .refine(nrCodeMatchesCategory.check, { message: nrCodeMatchesCategory.message, path: ["nr_code"] });
export type Course = z.infer<typeof courseSchema>;

/** Gera o slug a partir do nome (sem acentos, minusculas, hifens). */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Cursos de parceria nao emitem certificado (espelha o trigger do banco). */
export function canIssueCertificate(category: CourseCategory): boolean {
  return category !== "parceria";
}

export const personRegistrySchema = z.object({
  id: uuid,
  name: z.string().min(3),
  qualification: z.string().min(2),
  registry: z.string().min(1),
  signature_path: z.string().nullable(),
});
/** Dados editaveis de instrutor e responsavel tecnico (a assinatura vai por upload separado). */
export const personInputSchema = z.object({
  name: z.string().trim().min(3, "Informe o nome completo"),
  qualification: z.string().trim().min(2, "Informe a qualificacao (ex.: Engenheiro de Seguranca do Trabalho)"),
  registry: z.string().trim().min(1, "Informe o registro profissional (ex.: CREA-RJ 000000)"),
});
export type PersonInput = z.infer<typeof personInputSchema>;

export const instructorSchema = personRegistrySchema;
export const technicalLeadSchema = personRegistrySchema;

export const classStatusSchema = z.enum(["planned", "ongoing", "completed", "cancelled"]);

const classFields = {
  course_id: uuid,
  start_date: isoDate,
  end_date: isoDate,
  location: z.string().trim().min(2, "Informe o local do treinamento"),
  status: classStatusSchema,
};
const datesOrdered = {
  check: (c: { start_date: string; end_date: string }) => c.end_date >= c.start_date,
  message: "A data final nao pode ser anterior a inicial",
};

export const classInputSchema = z
  .object({ ...classFields, course_id: z.string().uuid("Escolha o treinamento") })
  .refine(datesOrdered.check, { message: datesOrdered.message, path: ["end_date"] });
export type ClassInput = z.infer<typeof classInputSchema>;

export const classSchema = z
  .object({ id: uuid, ...classFields })
  .refine(datesOrdered.check, { message: datesOrdered.message, path: ["end_date"] });

export const studentInputSchema = z.object({
  full_name: z.string().trim().min(3, "Informe o nome completo"),
  cpf: z
    .string()
    .refine(isValidCpf, "CPF invalido")
    .transform(onlyDigits),
  birth_date: isoDate.nullable(),
  phone: z.string().trim().nullable(),
  email: z.string().trim().email("E-mail invalido").nullable(),
  company: z.string().trim().nullable(),
});
export type StudentInput = z.infer<typeof studentInputSchema>;

export const enrollmentSchema = z.object({
  id: uuid,
  class_id: uuid,
  student_id: uuid,
  attendance_ok: z.boolean(),
  approved: z.boolean(),
});

export const certificateStatusSchema = z.enum(["valid", "revoked"]);

export const revokeCertificateSchema = z.object({
  reason: z.string().trim().min(5, "Descreva o motivo da revogacao"),
});

export const profileRoleSchema = z.enum(["admin", "secretaria"]);

/* Linha devolvida pelo RPC public.validate_certificate. */
export const publicValidationRowSchema = z.object({
  status: z.enum(["valid", "revoked", "expired", "rate_limited"]),
  student_name: z.string().nullable(),
  cpf_masked: z.string().nullable(),
  course_name: z.string().nullable(),
  workload_hours: z.number().nullable(),
  issued_at: z.string().nullable(),
  expires_at: z.string().nullable(),
});
export type PublicValidationRow = z.infer<typeof publicValidationRowSchema>;

/* Senha do admin: minimo de 10 caracteres, com letra e numero. O limite de 72 e o do bcrypt usado pelo Supabase Auth. */
export const newPasswordSchema = z
  .string()
  .min(10, "A senha deve ter pelo menos 10 caracteres.")
  .max(72, "A senha deve ter no máximo 72 caracteres.")
  .regex(/[A-Za-z]/, "A senha deve ter pelo menos uma letra.")
  .regex(/[0-9]/, "A senha deve ter pelo menos um número.");

export const emailSchema = z.string().trim().email("Informe um e-mail válido.");
