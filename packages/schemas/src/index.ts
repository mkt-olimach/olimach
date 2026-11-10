import { z } from "zod";
import { isValidCpf, onlyDigits } from "./cpf";

export { isValidCpf, maskCpf, onlyDigits } from "./cpf";

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
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Data invalida");

export const courseCategorySchema = z.enum(["nr", "profissionalizante", "parceria"]);
export type CourseCategory = z.infer<typeof courseCategorySchema>;

export const courseModalitySchema = z.enum(["presencial", "online", "hibrido"]);

export const courseSchema = z
  .object({
    id: uuid,
    slug: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    name: z.string().min(3),
    category: courseCategorySchema,
    nr_code: z
      .string()
      .regex(/^NR-\d{1,2}$/)
      .nullable(),
    workload_hours: z.number().int().positive(),
    syllabus: z.string(),
    modality: courseModalitySchema,
    validity_months: z.number().int().positive().nullable(),
    active: z.boolean(),
  })
  .refine((c) => (c.category === "nr") === (c.nr_code !== null), {
    message: "nr_code e obrigatorio para NR e proibido nas demais categorias",
    path: ["nr_code"],
  });
export type Course = z.infer<typeof courseSchema>;

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
export const instructorSchema = personRegistrySchema;
export const technicalLeadSchema = personRegistrySchema;

export const classStatusSchema = z.enum(["planned", "ongoing", "completed", "cancelled"]);

export const classSchema = z
  .object({
    id: uuid,
    course_id: uuid,
    start_date: isoDate,
    end_date: isoDate,
    location: z.string().min(2),
    status: classStatusSchema,
  })
  .refine((c) => c.end_date >= c.start_date, {
    message: "A data final nao pode ser anterior a inicial",
    path: ["end_date"],
  });

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
