import { z } from 'zod';

export const SupportContactSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters').max(100),
  email: z.string().email('Please enter a valid email address'),
  category: z.enum([
    'general',
    'billing',
    'technical',
    'account',
    'menu_setup',
    'hardware',
  ], {
    error: 'Please select an inquiry category',
  }),
  subject: z.string().min(3, 'Subject must be at least 3 characters').max(150),
  message: z.string().min(10, 'Message must be at least 10 characters').max(2000),
  referenceId: z.string().max(100).optional(),
});

export type SupportContactInput = z.infer<typeof SupportContactSchema>;

export const ProblemReportSchema = z.object({
  contactEmail: z.string().email('Please enter a valid contact email address'),
  category: z.enum([
    'bug',
    'payment',
    'ordering',
    'kitchen',
    'cashier',
    'inventory',
    'account',
    'security',
    'other',
  ], {
    error: 'Please select a problem category',
  }),
  description: z.string().min(10, 'Problem description must be at least 10 characters').max(2000),
  stepsToReproduce: z.string().min(10, 'Please provide steps to reproduce').max(2000),
  expectedBehavior: z.string().min(5, 'Expected behavior must be at least 5 characters').max(1000),
  actualBehavior: z.string().min(5, 'Actual behavior must be at least 5 characters').max(1000),
  deviceBrowser: z.string().max(200).optional(),
});

export type ProblemReportInput = z.infer<typeof ProblemReportSchema>;

export const SecurityReportSchema = z.object({
  researcherName: z.string().max(100).optional(),
  contactEmail: z.string().email('Please provide a valid email for coordinated disclosure'),
  summary: z.string().min(10, 'Vulnerability summary must be at least 10 characters').max(300),
  affectedArea: z.string().min(3, 'Affected component or URL is required').max(250),
  severity: z.enum(['low', 'medium', 'high', 'critical'], {
    error: 'Please select a severity level',
  }),
  reproductionSteps: z.string().min(20, 'Please provide detailed reproduction steps').max(4000),
  proofOfConcept: z.string().max(4000).optional(),
  adheresToPolicy: z.boolean().refine((val) => val === true, {
    message: 'You must confirm adherence to responsible testing rules',
  }),
});

export type SecurityReportInput = z.infer<typeof SecurityReportSchema>;
