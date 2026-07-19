FROM redis:7-alpine

COPY redis-init.sh /usr/local/bin/
RUN chmod +x /usr/local/bin/redis-init.sh

ENTRYPOINT ["redis-init.sh"]
CMD ["--protected-mode", "no"]