FROM postgres:16-alpine

COPY postgres_16_db-init.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/postgres_16_db-init.sh

ENTRYPOINT ["postgres_16_db-init.sh"]
CMD ["postgres"]