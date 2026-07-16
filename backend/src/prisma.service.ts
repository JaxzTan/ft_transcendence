import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
	db: InstanceType<typeof PrismaClient>;

	constructor() {
		// LOCAL/DOCKER: use PrismaPg adapter for direct Postgres access (Prisma 7 requirement)
		// VERCEL: comment out adapter line, comment out engineType in schema.prisma,
		//         and uncomment the accelerateUrl line below
		const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
		this.db = new PrismaClient({
			adapter,
		});
		/*
		// VERCEL alternative:
		const accelerateUrl = process.env["ACCELERATE_URL"];
		if (accelerateUrl) {
			this.db = new PrismaClient({ accelerateUrl });
		}
		*/
	}

	async onModuleInit() {
		await this.db.$connect();
	}

	async onModuleDestroy() {
		await this.db.$disconnect();
	}
}