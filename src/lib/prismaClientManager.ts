import { PrismaClient } from "@prisma/client";

// Global singleton to avoid connection exhaustion in Next.js dev mode
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const basePrisma = globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = basePrisma;

/**
 * Dynamic factory utility for schema-based multi-tenancy.
 * Injects `SET search_path` dynamically on every operational query checkout
 * to ensure absolute physical isolation.
 */
export function getTenantClient(subdomain: string) {
  const schemaName = `tenant_${subdomain}`;

  return basePrisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const centralModels = ["School", "PlatformAdmin"];

          // If querying a master registry model, skip the schema switch
          if (centralModels.includes(model as string)) {
            return query(args);
          }

          try {
            // We use an interactive transaction to guarantee connection stickiness 
            // for the search_path mutation before running the targeted query.
            return await basePrisma.$transaction(async (tx) => {
              // Dynamically set search_path to physically lock queries into the tenant schema
              await tx.$executeRawUnsafe(`SET search_path TO "${schemaName}", "public";`);
              
              // Execute the intended operational query within this isolated transactional connection
              return (tx as any)[model][operation](args);
            });
          } catch (error) {
            console.error(`[PrismaClientManager] Query isolation error for tenant ${subdomain}:`, error);
            throw error;
          }
        },
      },
    },
  });
}
