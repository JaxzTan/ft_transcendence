import { Injectable, OnModuleInit, OnModuleDestroy } from '@nestjs/common';
import { PrismaClient } from '../generated/prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { Pool } from 'pg';
import { requireSecret } from './secrets';

@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
	db: InstanceType<typeof PrismaClient>;

	constructor() {
		// LOCAL/DOCKER: use PrismaPg adapter for direct Postgres access (Prisma 7 requirement)
		// VERCEL: comment out adapter line, comment out engineType in schema.prisma,
		//         and uncomment the accelerateUrl line below
		// DATABASE_URL is the one secret that is env-first: docker-entrypoint.sh
		// assembles the container-correct URL (host "db") from db_credentials +
		// db_password. The secrets file holds the host-side localhost URL and is
		// only the right answer when running outside Docker.
		const connectionString = process.env.DATABASE_URL || requireSecret('DATABASE_URL');
		const pool = new Pool({ connectionString, max: 5 }); //changes made 23/7 by bing
		const adapter = new PrismaPg(pool); //changes made 23/7 by bing
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